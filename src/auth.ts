import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"
import settings from "@/settings/settings.json"

function normalizeAuthUrlEnv() {
  const configuredUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL
  if (!configuredUrl) return

  const trimmed = configuredUrl.trim().replace(/\/$/, "")
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  process.env.AUTH_URL = normalized
  process.env.NEXTAUTH_URL = normalized
}

normalizeAuthUrlEnv()

export const { handlers, signIn, signOut, auth } = NextAuth({
  basePath: "/api/auth",
  trustHost: true,
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID!,
      clientSecret: process.env.AUTH_DISCORD_SECRET!,
      authorization: {
        params: {
          scope: "identify email guilds guilds.members.read",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Initial sign in
      if (account && profile) {
        token.discordId = profile.id
        token.username = profile.username
        token.discriminator = profile.discriminator
        token.avatar = profile.avatar
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at // Unix timestamp in seconds
        const expiresAt = account.expires_at

        console.log("[Auth] New token stored:", {
          hasAccessToken: !!token.accessToken,
          hasRefreshToken: !!token.refreshToken,
          expiresAt: token.expiresAt,
          expiresIn: expiresAt ? expiresAt - Math.floor(Date.now() / 1000) : null,
        })

        // Fetch user's roles in the guild with role names
        try {
          // First, get the user's role IDs
          const memberResponse = await fetch(
            `https://discord.com/api/v10/users/@me/guilds/${settings.discord.guildId}/member`,
            {
              headers: {
                Authorization: `Bearer ${account.access_token}`,
              },
            }
          )

          if (memberResponse.ok) {
            const member = await memberResponse.json()
            const userRoleIds = member.roles || []

            // Fetch guild roles using bot token to get role names
            const botToken = process.env.DISCORD_BOT_TOKEN
            if (botToken && userRoleIds.length > 0) {
              const rolesResponse = await fetch(
                `https://discord.com/api/v10/guilds/${settings.discord.guildId}/roles`,
                {
                  headers: {
                    Authorization: `Bot ${botToken}`,
                  },
                }
              )

              if (rolesResponse.ok) {
                const guildRoles = await rolesResponse.json()
                // Map user's role IDs to role objects with names
                token.roleDetails = userRoleIds.map((roleId: string) => {
                  const role = guildRoles.find((r: any) => r.id === roleId)
                  return {
                    id: roleId,
                    name: role?.name || "Unknown",
                  }
                })
              } else {
                // Fallback: just store IDs
                token.roleDetails = userRoleIds.map((roleId: string) => ({
                  id: roleId,
                  name: "Role",
                }))
              }
            } else {
              token.roleDetails = []
            }

            // Keep the old roles array for backward compatibility
            token.roles = userRoleIds
          }
        } catch (error) {
          console.error("Error fetching Discord guild member:", error)
          token.roles = []
          token.roleDetails = []
        }
      }

      // Token refresh logic - check if token is expired or about to expire
      const now = Math.floor(Date.now() / 1000)
      const expiresAt = token.expiresAt as number | undefined

      if (expiresAt && expiresAt - now < 300 && token.refreshToken) {
        // Token expires in less than 5 minutes, refresh it
        console.log("[Auth] Token expiring soon, refreshing...")
        try {
          const response = await fetch("https://discord.com/api/v10/oauth2/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: process.env.AUTH_DISCORD_ID!,
              client_secret: process.env.AUTH_DISCORD_SECRET!,
              grant_type: "refresh_token",
              refresh_token: token.refreshToken as string,
            }),
          })

          if (response.ok) {
            const refreshedTokens = await response.json()
            token.accessToken = refreshedTokens.access_token
            token.refreshToken = refreshedTokens.refresh_token ?? token.refreshToken
            token.expiresAt = Math.floor(Date.now() / 1000) + refreshedTokens.expires_in
            console.log("[Auth] Token refreshed successfully")
          } else {
            console.error("[Auth] Failed to refresh token:", await response.text())
          }
        } catch (error) {
          console.error("[Auth] Error refreshing token:", error)
        }
      }

      return token
    },
    async session({ session, token }) {
      // Ensure session.user exists before setting properties
      if (session?.user && token) {
        session.user.discordId = token.discordId as string
        session.user.username = token.username as string
        session.user.discriminator = token.discriminator as string
        // Handle avatar being null/undefined
        session.user.avatar = (token.avatar as string) || ""
        session.user.roles = (token.roles as string[]) || []
        session.user.roleDetails = (token.roleDetails as Array<{ id: string; name: string }>) || []
        session.user.accessToken = token.accessToken as string
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
})
