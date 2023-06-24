export const API_KEYS = {
  FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,

  BLOCKFROST_API_KEY: process.env.BLOCKFROST_API_KEY || '',
}

export const POLICY_IDS = {
  BAD_KEY: '80e3ccc66f4dfeff6bc7d906eb166a984a1fc6d314e33721ad6add14',
}

// local storage keys
export const LS_KEYS = {
  WALLET_PROVIDER: 'WALLET_PROVIDER',
}
