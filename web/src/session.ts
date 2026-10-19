import { createSlice, type PayloadAction, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit'
import { api } from './api'

const KEY = 'wa.userId'

function load(): number {
  try {
    const n = Number(localStorage.getItem(KEY))
    return Number.isInteger(n) && n > 0 ? n : 1
  } catch {
    return 1
  }
}

const sessionSlice = createSlice({
  name: 'session',
  initialState: { userId: load() },
  reducers: {
    setUser(state, action: PayloadAction<number>) {
      state.userId = action.payload
      try {
        localStorage.setItem(KEY, String(action.payload))
      } catch {
        // storage unavailable: the selection just won't persist
      }
    },
  },
})

export const { setUser } = sessionSlice.actions
export default sessionSlice.reducer

export const switchUser =
  (id: number): ThunkAction<void, unknown, undefined, UnknownAction> =>
  (dispatch) => {
    dispatch(setUser(id))
    dispatch(api.util.resetApiState())
  }
