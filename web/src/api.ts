import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { Me, UserSummary } from './types'

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: `${location.origin}/api`, // absolute: fetchBaseQuery builds a Request, which rejects relative URLs outside browsers
    prepareHeaders: (headers, { getState }) => {
      headers.set('X-User-Id', String((getState() as { session: { userId: number } }).session.userId))
      return headers
    },
  }),
  tagTypes: ['Me', 'Users', 'Rules', 'Channels', 'MyDeliveries', 'AdminUsers', 'AdminRules', 'Events', 'Deliveries', 'Sources'],
  endpoints: (build) => ({
    getMe: build.query<Me, void>({ query: () => '/me', providesTags: ['Me'] }),
    getUsers: build.query<UserSummary[], void>({ query: () => '/users', providesTags: ['Users'] }),
  }),
})

export const { useGetMeQuery, useGetUsersQuery } = api
