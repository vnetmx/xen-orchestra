import React from 'react'
import styled from 'styled-components'
import { omit } from 'lodash'

import ActionButton from './action-button'
import propTypes from './prop-types-decorator'

// do not forward `state` to ActionButton
const Button = styled(p => <ActionButton {...omit(p, 'state')} />)`
  background-color: ${p =>
    p.theme[`${p.state ? 'enabled' : 'disabled'}StateBg`]};
  border: 2px solid
    ${p => p.theme[`${p.state ? 'enabled' : 'disabled'}StateColor`]};
  color: ${p => p.theme[`${p.state ? 'enabled' : 'disabled'}StateColor`]};
`

const StateButton = ({
  disabledHandler,
  disabledHandlerParam,
  disabledLabel,
  disabledTooltip,

  enabledLabel,
  enabledTooltip,
  enabledHandler,
  enabledHandlerParam,

  state,
  ...props
}) => (
  <Button
    handler={state ? enabledHandler : disabledHandler}
    handlerParam={state ? enabledHandlerParam : disabledHandlerParam}
    tooltip={state ? enabledTooltip : disabledTooltip}
    {...props}
    icon={state ? 'running' : 'halted'}
    size='small'
    state={state}
  >
    {state ? enabledLabel : disabledLabel}
  </Button>
)

export default propTypes({
  state: propTypes.bool.isRequired,
})(StateButton)
