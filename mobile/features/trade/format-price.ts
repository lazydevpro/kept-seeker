/**
 * A unit price, in dollars. Places follow the size of the number: a bitcoin reads
 * "$85,939", a share "$380.71", and SKR "$0.0176" rather than a rounded "$0.02".
 *
 * Pinned to en-US: the device locale renders USD as "US$100.00" outside the US,
 * and these are always dollars.
 */
export function formatPrice(value: number) {
  const digits = value >= 1000 ? 0 : value >= 1 ? 2 : value >= 0.01 ? 4 : 6
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
