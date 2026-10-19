import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type {
  AdminDelivery, AdminRule, Channel, ChannelInput, ChannelPatch, EventRow, InjectInput, InjectResult, Me, MyDelivery, PollResult, Rule, RuleInput,
  Source, SourcePatch, TestResult, UserSummary,
} from './types'

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
    getRules: build.query<Rule[], void>({ query: () => '/rules', providesTags: ['Rules'] }),
    createRule: build.mutation<Rule, RuleInput>({ query: (body) => ({ url: '/rules', method: 'POST', body }), invalidatesTags: ['Rules'] }),
    updateRule: build.mutation<Rule, { id: number } & Partial<RuleInput>>({
      query: ({ id, ...body }) => ({ url: `/rules/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Rules'],
    }),
    deleteRule: build.mutation<void, number>({ query: (id) => ({ url: `/rules/${id}`, method: 'DELETE' }), invalidatesTags: ['Rules'] }),
    getChannels: build.query<Channel[], void>({ query: () => '/channels', providesTags: ['Channels'] }),
    createChannel: build.mutation<Channel, ChannelInput>({ query: (body) => ({ url: '/channels', method: 'POST', body }), invalidatesTags: ['Channels'] }),
    updateChannel: build.mutation<Channel, ChannelPatch>({
      query: ({ id, ...body }) => ({ url: `/channels/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Channels'],
    }),
    // a deleted channel is also dropped from rules' channelIds server-side
    deleteChannel: build.mutation<void, number>({
      query: (id) => ({ url: `/channels/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Channels', 'Rules'],
    }),
    testChannel: build.mutation<TestResult, number>({ query: (id) => ({ url: `/channels/${id}/test`, method: 'POST' }) }),
    getMyDeliveries: build.query<MyDelivery[], void>({ query: () => '/my/deliveries', providesTags: ['MyDeliveries'] }),
    getAdminUsers: build.query<Me[], void>({ query: () => '/admin/users', providesTags: ['AdminUsers'] }),
    getAdminRules: build.query<AdminRule[], void>({ query: () => '/admin/rules', providesTags: ['AdminRules'] }),
    getEvents: build.query<EventRow[], void>({ query: () => '/admin/events?limit=100', providesTags: ['Events'] }),
    getDeliveries: build.query<AdminDelivery[], string | void>({
      query: (status) => (status ? `/admin/deliveries?status=${status}` : '/admin/deliveries'),
      providesTags: ['Deliveries'],
    }),
    retryDelivery: build.mutation<AdminDelivery, number>({
      query: (id) => ({ url: `/admin/deliveries/${id}/retry`, method: 'POST' }),
      invalidatesTags: ['Deliveries', 'MyDeliveries'],
    }),
    getSources: build.query<Source[], void>({ query: () => '/admin/sources', providesTags: ['Sources'] }),
    updateSource: build.mutation<Source, SourcePatch>({
      query: ({ id, ...body }) => ({ url: `/admin/sources/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Sources'],
    }),
    pollSource: build.mutation<PollResult, number>({
      query: (id) => ({ url: `/admin/sources/${id}/poll`, method: 'POST' }),
      invalidatesTags: ['Sources', 'Events'],
    }),
    injectEvent: build.mutation<InjectResult, InjectInput>({
      query: (body) => ({ url: '/admin/events', method: 'POST', body }),
      invalidatesTags: ['Events', 'Deliveries', 'MyDeliveries'],
    }),
  }),
})

export const {
  useGetMeQuery,
  useGetUsersQuery,
  useGetRulesQuery,
  useCreateRuleMutation,
  useUpdateRuleMutation,
  useDeleteRuleMutation,
  useGetChannelsQuery,
  useCreateChannelMutation,
  useUpdateChannelMutation,
  useDeleteChannelMutation,
  useTestChannelMutation,
  useGetMyDeliveriesQuery,
  useGetAdminUsersQuery,
  useGetAdminRulesQuery,
  useGetEventsQuery,
  useGetDeliveriesQuery,
  useRetryDeliveryMutation,
  useGetSourcesQuery,
  useUpdateSourceMutation,
  usePollSourceMutation,
  useInjectEventMutation,
} = api

/** Message for a failed RTK Query call: the API's `error` plus any zod issue messages. */
export function errorText(err: unknown): string {
  const data = (err as { data?: { error?: string; issues?: { path?: unknown[]; message?: string }[] } })?.data
  if (!data?.error) return 'Request failed'
  const issues = (data.issues ?? []).map((i) => `${i.path?.join('.') ?? ''}: ${i.message ?? ''}`)
  return [data.error, ...issues].join(' | ')
}
