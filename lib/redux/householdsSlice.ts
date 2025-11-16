'use client'

import type { Family, Household } from '@/types'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '.'

interface HouseholdsState {
  value: Household[] // current page households
  currentPage: number // current page
  pageSize: number // page size
  totalCount: number // total households in DB
}

const initialState: HouseholdsState = {
  value: [],
  currentPage: 1,
  pageSize: 20,
  totalCount: 0
}

// ------------------
// Selectors
// ------------------
export const selectHouseholds = (state: RootState) => state.householdsList.value

export const selectPaginatedHouseholds = (state: RootState) =>
  state.householdsList.value

export const selectTotalPages = (state: RootState) => {
  const { totalCount, pageSize } = state.householdsList
  return totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1
}

// ------------------
// Slice
// ------------------
export const householdsSlice = createSlice({
  name: 'householdsList',
  initialState,
  reducers: {
    // Replace current page households and totalCount
    setHouseholds: (
      state,
      action: PayloadAction<{
        households: Household[]
        totalCount: number
        page: number
      }>
    ) => {
      state.value = action.payload.households
      state.totalCount = action.payload.totalCount
      state.currentPage = action.payload.page
    },

    // Household-level reducers
    updateHousehold: (state, action: PayloadAction<Household>) => {
      const index = state.value.findIndex((h) => h.id === action.payload.id)
      if (index !== -1) {
        state.value[index] = action.payload
      }
    },
    addHousehold: (state, action: PayloadAction<Household>) => {
      state.value.unshift(action.payload)
      state.totalCount += 1
    },
    deleteHousehold: (state, action: PayloadAction<number>) => {
      state.value = state.value.filter((h) => h.id !== action.payload)
      state.totalCount -= 1
    },

    // Family-level reducers
    addFamily: (
      state,
      action: PayloadAction<{ householdId: number; family: Family }>
    ) => {
      const { householdId, family } = action.payload
      const household = state.value.find((h) => h.id === householdId)
      if (household) {
        household.families = [...(household.families ?? []), family]
      }
    },
    updateFamily: (
      state,
      action: PayloadAction<{ householdId: number; family: Family }>
    ) => {
      const { householdId, family } = action.payload
      const household = state.value.find((h) => h.id === householdId)
      if (household?.families) {
        const idx = household.families.findIndex((f) => f.id === family.id)
        if (idx !== -1) {
          household.families[idx] = family
        }
      }
    },
    deleteFamily: (
      state,
      action: PayloadAction<{ householdId: number; familyId: number }>
    ) => {
      const { householdId, familyId } = action.payload
      const household = state.value.find((h) => h.id === householdId)
      if (household?.families) {
        household.families = household.families.filter((f) => f.id !== familyId)
      }
    },

    // Pagination
    setPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload
    },
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pageSize = action.payload
      state.currentPage = 1
    }
  }
})

export const {
  setHouseholds,
  updateHousehold,
  addHousehold,
  deleteHousehold,
  addFamily,
  updateFamily,
  deleteFamily,
  setPage,
  setPageSize
} = householdsSlice.actions

export default householdsSlice.reducer
