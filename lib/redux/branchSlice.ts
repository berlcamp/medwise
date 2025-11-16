'use client'

import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface BranchState {
  selectedBranchId: number | null
}

const initialState: BranchState = {
  selectedBranchId:
    typeof window !== 'undefined'
      ? Number(localStorage.getItem('selectedBranchId')) || 1
      : 1
}

export const branchSlice = createSlice({
  name: 'branch',
  initialState,
  reducers: {
    setBranch: (state, action: PayloadAction<number>) => {
      state.selectedBranchId = action.payload
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedBranchId', action.payload.toString())
      }
    },
    clearBranch: (state) => {
      state.selectedBranchId = null
      if (typeof window !== 'undefined') {
        localStorage.removeItem('selectedBranchId')
      }
    }
  }
})

export const { setBranch, clearBranch } = branchSlice.actions
export default branchSlice.reducer
