import '../styles/globals.css'
import type { AppProps } from 'next/app'
import React from 'react'
import { WalletProvider } from '../src/walletContext'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WalletProvider>
      <Component {...pageProps} />
    </WalletProvider>
  )
} 