"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { fetchMe, signOut as endHubSession, type Me } from "@/modules/identity/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, User, Coins } from "lucide-react"
import { useTokenBalance } from "@/hooks/use-token-balance"
import { getDisplayRoles } from "@/lib/roles"
import Link from "next/link"

export function AuthButton() {
  const { data: session, status } = useSession()
  const { balance } = useTokenBalance()
  const router = useRouter()

  // Signed in by email or passkey: no Discord session, but very much signed in.
  const [hubAccount, setHubAccount] = useState<Me | null>(null)
  useEffect(() => {
    let cancelled = false
    fetchMe()
      .then((account) => !cancelled && setHubAccount(account))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [session])

  async function signOutEverywhere() {
    try {
      await endHubSession()
    } catch {
      /* the next-auth sign-out below still runs */
    }
    setHubAccount(null)
    if (session) await signOut({ callbackUrl: "/" })
    else {
      router.push("/")
      router.refresh()
    }
  }

  if (status === "loading") {
    return (
      <Button variant="ghost" size="icon" disabled>
        <User className="w-5 h-5" />
      </Button>
    )
  }

  if (session?.user) {
    const avatarUrl = session.user.avatar
      ? `https://cdn.discordapp.com/avatars/${session.user.discordId}/${session.user.avatar}.png`
      : null

    const displayRoles = getDisplayRoles(session.user.roleDetails || [])

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="w-8 h-8">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {session.user.username?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuLabel>
            <div className="space-y-2">
              <p className="font-medium">{session.user.username}</p>

              {/* CHT Balance */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Coins className="w-3.5 h-3.5" />
                <span>{balance !== null ? `${balance} CHT` : "Loading..."}</span>
              </div>

              {/* Roles */}
              {displayRoles.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {displayRoles.map((role) => (
                    <span
                      key={role.id}
                      className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                    >
                      {role.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href={`/members/${session.user.username}`}>
              <User className="w-4 h-4 mr-2" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={signOutEverywhere} className="cursor-pointer">
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (hubAccount) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {hubAccount.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuLabel>{hubAccount.displayName}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {hubAccount.hasDiscord ? (
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href={`/members/${hubAccount.displayName}`}>
                <User className="w-4 h-4 mr-2" />
                Profile
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/signin">Connect Discord</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={signOutEverywhere} className="cursor-pointer">
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Signed out: to the sign-in page and its choices — email code, passkey,
  // Discord — rather than straight into one provider.
  return (
    <Button variant="ghost" size="icon" asChild aria-label="Sign in">
      <Link href="/signin">
        <User className="w-5 h-5" />
      </Link>
    </Button>
  )
}
