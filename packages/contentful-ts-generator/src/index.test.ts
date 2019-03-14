import test from 'ava'

import { sum } from './index'

test('1 + 1 = 2', (t) => {
  t.true(sum(1, 1) == 2)
})
