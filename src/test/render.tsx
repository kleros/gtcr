import React, { type ReactElement, type ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'contexts/theme-context'

interface Options extends Omit<RenderOptions, 'wrapper'> {
  /** The URL the component sees (react-router's MemoryRouter). */
  route?: string
}

/**
 * Renders a component inside what the app wraps every page in (minus the
 * wallet): the theme, a router at `route`, and a fresh React Query client
 * that never retries, so a failed read shows at once.
 */
export const renderWithProviders = (
  ui: ReactElement,
  { route = '/', ...options }: Options = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {/* The app's router flags (bootstrap/app.tsx); startTransition is
          off there too, said explicitly so the router does not warn. */}
      <MemoryRouter
        initialEntries={[route]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: false }}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) }
}
