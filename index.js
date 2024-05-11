MAX_SIGNED_31_BIT_INT = 1073741823

const Idle = 2
const Sync = MAX_SIGNED_31_BIT_INT
const Batched = Sync - 1

const UNIT_SIZE = 10
const MAGIC_NUMBER_OFFSET = Batched - 1

function ceiling(num, precision) {
  return (((num / precision) | 0) + 1) * precision
}

function computeExpirationBucket(currentTime, expirationInMs, bucketSizeMs) {
  return (
    MAGIC_NUMBER_OFFSET -
    ceiling(
      MAGIC_NUMBER_OFFSET - currentTime + expirationInMs / UNIT_SIZE,
      bucketSizeMs / UNIT_SIZE
    )
  )
}

const LOW_PRIORITY_EXPIRATION = 5000
const LOW_PRIORITY_BATCH_SIZE = 250

function computeAsyncExpiration(currentTime) {
  return computeExpirationBucket(
    currentTime,
    LOW_PRIORITY_EXPIRATION,
    LOW_PRIORITY_BATCH_SIZE
  )
}

const HIGH_PRIORITY_EXPIRATION = 500
const HIGH_PRIORITY_BATCH_SIZE = 100

function computeInteractiveExpiration(currentTime) {
  return computeExpirationBucket(
    currentTime,
    HIGH_PRIORITY_EXPIRATION,
    HIGH_PRIORITY_BATCH_SIZE
  )
}

// 1 unit of expiration time represents 10ms.
function msToExpirationTime(ms) {
  // Always add an offset so that we don't clash with the magic number for NoWork.
  return MAGIC_NUMBER_OFFSET - ((ms / UNIT_SIZE) | 0)
}

const currentTime = msToExpirationTime(Date.now())
console.log('currentTime', currentTime)
console.log('async expiration', computeAsyncExpiration())
console.log('interactive expiration', computeInteractiveExpiration())
