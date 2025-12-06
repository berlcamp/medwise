'use client'

import ConsignmentForm from './ConsignmentForm'
import Notfoundpage from '@/components/Notfoundpage'
import { useAppSelector } from '@/lib/redux/hook'

export default function ConsignmentPage() {
  const user = useAppSelector((state) => state.user.user)
  
  if (user?.type === 'cashier') return <Notfoundpage />
  
  return <ConsignmentForm />
}
