'use client'

import { useEffect } from 'react'

export default function VisitorBootstrap() {
  useEffect(() => {
    fetch('/api/visitor', {
      method: 'GET',
      credentials: 'include',
    }).catch((error) => {
      console.error('Failed to initialize visitor session:', error)
    })
  }, [])

  return null
}