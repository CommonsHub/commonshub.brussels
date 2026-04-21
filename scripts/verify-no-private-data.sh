#!/bin/bash

# Script to verify that no private/sensitive information exists in cached Stripe data
# This should be run before committing to ensure no PII is being stored

echo "🔍 Verifying no private data in Stripe cache files..."
echo ""

# Define sensitive fields to check for
SENSITIVE_FIELDS=(
  "billing_details"
  "shipping"
  "destination_details"
  "receipt_email"
  "payment_method_details"
  "email"
)

# Track if any sensitive data is found
FOUND_SENSITIVE=0

# Check each field
for field in "${SENSITIVE_FIELDS[@]}"; do
  count=$(grep -r "\"$field\"" data/*/*/stripe/ 2>/dev/null | wc -l | tr -d ' ')

  if [ "$count" -gt 0 ]; then
    echo "❌ FAIL: Found $count occurrences of \"$field\""
    FOUND_SENSITIVE=1
  else
    echo "✅ PASS: No \"$field\" found"
  fi
done

echo ""
echo "=" | head -c 60
echo ""

if [ $FOUND_SENSITIVE -eq 0 ]; then
  echo "✅ ALL CHECKS PASSED - No sensitive data found!"
  echo ""
  echo "Safe to commit stripe.json files."
  exit 0
else
  echo "❌ CHECKS FAILED - Sensitive data detected!"
  echo ""
  echo "DO NOT commit these files. Run the following to fix:"
  echo "  1. Delete old cache: find data -type d -name \"stripe\" -exec rm -rf {} +"
  echo "  2. Re-sync data via the external data-sync process"
  echo "  3. Re-run this script: ./scripts/verify-no-private-data.sh"
  exit 1
fi
