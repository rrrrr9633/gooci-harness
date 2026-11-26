import { GoociMark } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the GOOCI mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the GOOCI hexagon mark.
 */
export function OfficialBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return <GoociMark size={size} />
}

/**
 * Render the GOOCI name beside the independently slotted mark.
 * @returns the GOOCI wordmark.
 */
export function OfficialBrandName() {
  return <span>GOOCI</span>
}
