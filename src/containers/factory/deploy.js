import { Button, Card, Form, Icon } from 'antd'
import { nextStep, previousStep } from '../../redux/factory-wizard'
import { useDispatch, useSelector } from 'react-redux'
import React from 'react'
import styled from 'styled-components/macro'

const ButtonGroup = Button.Group

const StyledStepper = styled.div`
  display: flex;
  align-items: flex-end;
  flex-direction: column;
`

const TCRDeploy = () => {
  const { currStep, numSteps } = useSelector(state => state.factoryWizard)
  const dispatch = useDispatch()

  return (
    <Card title="Deploy TCR">
      <Form>
        <StyledStepper>
          <ButtonGroup>
            <Button
              disabled={currStep === 1}
              onClick={() => dispatch(previousStep())}
              type="primary"
            >
              <Icon type="left" />
              Previous
            </Button>
            <Button
              disabled={currStep === numSteps}
              onClick={() => dispatch(nextStep())}
              type="primary"
            >
              Next
              <Icon type="right" />
            </Button>
          </ButtonGroup>
        </StyledStepper>
      </Form>
    </Card>
  )
}

export default Form.create({ name: 'tcrDeploy' })(TCRDeploy)
