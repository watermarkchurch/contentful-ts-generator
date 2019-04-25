import test from 'ava'
import sum from '.'

test('adds 1 + 1', (t) => {
  const result = sum(1, 1)

  t.deepEqual(result, 2)
})
