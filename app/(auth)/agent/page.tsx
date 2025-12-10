'use client'

import Notfoundpage from '@/components/Notfoundpage'
import { useAppSelector } from '@/lib/redux/hook'
import AgentForm from './AgentForm'

export default function Page() {
  const user = useAppSelector((state) => state.user.user)

  if (user?.type === 'user' || user?.type === 'cashier') return <Notfoundpage />

  return <AgentForm />
}
