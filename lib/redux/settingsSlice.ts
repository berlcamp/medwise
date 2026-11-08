import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { DEFAULT_CLOSE_END, DEFAULT_CLOSE_START } from '@/lib/utils/systemClose'

// Org-wide toggles from medwise.org_settings, managed on the System Settings
// page and loaded by AuthGuard.
export interface SettingsState {
  printReceiptsEnabled: boolean
  systemClosed: boolean
  systemClosedMessage: string
  closeScheduleEnabled: boolean
  closeStartTime: string // "HH:MM", Asia/Manila
  closeEndTime: string // "HH:MM", Asia/Manila
}

const initialState: SettingsState = {
  printReceiptsEnabled: true,
  systemClosed: false,
  systemClosedMessage: '',
  closeScheduleEnabled: false,
  closeStartTime: DEFAULT_CLOSE_START,
  closeEndTime: DEFAULT_CLOSE_END
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setSettings: (state, action: PayloadAction<Partial<SettingsState>>) => {
      Object.assign(state, action.payload)
    }
  }
})

export const { setSettings } = settingsSlice.actions
export default settingsSlice.reducer
