import { configureStore } from '@reduxjs/toolkit'
import branchReducer from './branchSlice'
import householdsReducer from './householdsSlice'
import listReducer from './listSlice'
import locationReducer from './locationSlice'
import locationsReducer from './locationsSlice'
import stocksReducer from './stocksSlice'
import userReducer from './userSlice'

export const store = configureStore({
  reducer: {
    location: locationReducer,
    list: listReducer,
    locationsList: locationsReducer,
    branch: branchReducer,
    user: userReducer,
    stocksList: stocksReducer,
    householdsList: householdsReducer
  }
})

// Infer the `RootState` type from the store
export type RootState = ReturnType<typeof store.getState>

// You can also export the `AppDispatch` type
export type AppDispatch = typeof store.dispatch
