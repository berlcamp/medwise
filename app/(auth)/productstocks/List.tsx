'use client'

import { ConfirmationModal } from '@/components/ConfirmationModal'
import { Button } from '@/components/ui/button'
import { useAppDispatch } from '@/lib/redux/hook'
import { deleteItem } from '@/lib/redux/listSlice'
import { supabase } from '@/lib/supabase/client'
import { ProductStock, RootState } from '@/types'
import { format, isBefore, parseISO } from 'date-fns'
import { MinusCircle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { RemoveStockModal } from './RemoveStockModal'

// view table
const table = 'product_stocks'

export const List = () => {
  const dispatch = useAppDispatch()
  const list = useSelector((state: RootState) => state.list.value)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalRemoveOpen, setModalRemoveOpen] = useState(false)

  const [selectedItem, setSelectedItem] = useState<ProductStock | null>(null)

  const handleDelete = async () => {
    if (!selectedItem) return
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', selectedItem.id)
    if (error) {
      if (error.code === '23503')
        toast.error('Selected record cannot be deleted.')
      else toast.error(error.message)
      return
    }
    toast.success('Successfully deleted!')
    dispatch(deleteItem(selectedItem))
    setIsModalOpen(false)
  }

  return (
    <div className="overflow-x-none">
      <table className="app__table">
        <thead className="app__thead">
          <tr>
            <th className="app__th">Product / Details</th>
            <th className="app__th">Category / Batch</th>
            <th className="app__th">Remaining Stocks</th>
            <th className="app__th">Purchase Price</th>
            <th className="app__th"></th>
          </tr>
        </thead>
        <tbody>
          {list.map((item: ProductStock) => {
            const expDate = item.expiration_date
              ? parseISO(item.expiration_date)
              : null
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const isExpired = expDate ? isBefore(expDate, today) : false
            const formattedExp = expDate ? format(expDate, 'MMM dd, yyyy') : '-'
            const formattedMfg = item.date_manufactured
              ? format(parseISO(item.date_manufactured), 'MMM dd, yyyy')
              : '-'

            return (
              <tr key={item.id} className="app__tr">
                {/* Product column: name + manufacturer + manufacturing + expiration */}
                <td className="app__td">
                  <div className="font-semibold">{item.product?.name}</div>
                  <div className="text-xs text-gray-600">
                    {item.manufacturer && <>Mfg: {item.manufacturer}, </>}
                    {item.date_manufactured && (
                      <>Manufactured: {formattedMfg}, </>
                    )}
                    Exp: {formattedExp}
                    {isExpired && (
                      <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded">
                        Expired
                      </span>
                    )}
                  </div>
                </td>

                {/* Category column: category + batch # + supplier */}
                <td className="app__td">
                  <div className="text-xs font-semibold">
                    {item.product?.category}
                  </div>
                  <div className="text-xs text-gray-600">
                    {item.batch_no && <>Batch: {item.batch_no}, </>}
                    Supplier: {item.supplier?.name || '-'}
                  </div>
                </td>

                <td className="app__td">{item.remaining_quantity}</td>

                <td className="app__td">
                  {item.purchase_price ? item.purchase_price.toFixed(2) : '-'}
                </td>

                <td className="app__td">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      className="text-red-500"
                      onClick={() => {
                        setSelectedItem(item)
                        setIsModalOpen(true)
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      className="text-yellow-500"
                      onClick={() => {
                        setSelectedItem(item)
                        setModalRemoveOpen(true)
                      }}
                    >
                      <MinusCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <RemoveStockModal
        isOpen={modalRemoveOpen}
        onClose={() => setModalRemoveOpen(false)}
        selectedItem={selectedItem}
      />

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDelete}
        message="Are you sure you want to delete this?"
      />
    </div>
  )
}
