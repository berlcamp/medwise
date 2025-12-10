'use client'

import Notfoundpage from '@/components/Notfoundpage'
import { useAppSelector } from '@/lib/redux/hook'
import QuotationForm from './QuotationForm'

export default function Page() {
  const user = useAppSelector((state) => state.user.user)

  if (user?.type === 'user' || user?.type === 'cashier') return <Notfoundpage />

  return <QuotationForm />
}
