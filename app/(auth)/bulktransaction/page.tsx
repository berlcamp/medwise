'use client'

import TransactionForm from '@/components/TransactionForm'
import Notfoundpage from '@/components/Notfoundpage'
import { useAppSelector } from '@/lib/redux/hook'

export default function BulkTransactionPage() {
  const user = useAppSelector((state) => state.user.user)
  
  if (user?.type === 'cashier') return <Notfoundpage />
  
  return <TransactionForm transactionType="bulk" />
}
