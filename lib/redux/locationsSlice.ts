'use client'

import { Location } from '@/types'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// Define the initial state with a list of items
const initialState = {
  value: [] as Location[] // Replace `any[]` with a specific type (e.g., `Supplier[]`) if needed
}

export const locationsSlice = createSlice({
  name: 'locationsList', // Name of the slice
  initialState,
  reducers: {
    // add to list
    addList: (state, action: PayloadAction<Location[]>) => {
      state.value = action.payload
    },
    // Update an item in the list by its `id`
    updateList: (state, action: PayloadAction<Location>) => {
      const index = state.value.findIndex(
        (item) => item.id === action.payload.id
      )
      if (index !== -1) {
        state.value[index] = action.payload
      }
    },
    // Add a new item to the list
    addItem: (state, action: PayloadAction<Location>) => {
      state.value.push(action.payload)
    },

    // Delete an item from the list by its `id`
    deleteItem: (state, action: PayloadAction<Location>) => {
      state.value = state.value.filter((item) => item.id !== action.payload.id)
    }
  }
})

export const { addList, updateList, addItem, deleteItem } =
  locationsSlice.actions

export default locationsSlice.reducer
