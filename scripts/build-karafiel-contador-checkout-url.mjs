#!/usr/bin/env node
import process from 'node:process'

const apiBaseUrl = (process.env.DHANAM_API_BASE_URL || 'https://api.dhan.am').replace(/\/+$/, '')
const userId = process.env.JANUA_USER_ID || process.env.DHANAM_CHECKOUT_USER_ID
const returnUrl =
  process.env.DHANAM_CHECKOUT_RETURN_URL || 'https://karafiel.mx/billing/success'

if (!userId) {
  console.error('JANUA_USER_ID or DHANAM_CHECKOUT_USER_ID is required')
  process.exit(2)
}

const params = new URLSearchParams({
  plan: 'karafiel_contador',
  product: 'karafiel',
  user_id: userId,
  return_url: returnUrl,
})

console.log(`${apiBaseUrl}/billing/checkout?${params.toString()}`)
