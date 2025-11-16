// lib/redux/locationSlice.ts
import { Location } from '@/types'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface LocationState {
  selectedLocation: Location | null
}

const initialState: LocationState = {
  selectedLocation: null
}

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setLocation(state, action: PayloadAction<Location>) {
      state.selectedLocation = action.payload
    },
    clearLocation(state) {
      state.selectedLocation = null
    }
  }
})

export const { setLocation, clearLocation } = locationSlice.actions
export default locationSlice.reducer
