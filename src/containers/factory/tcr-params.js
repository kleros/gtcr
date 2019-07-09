import { Button, Card, Form, Icon, Input, Tooltip } from 'antd'
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

const TCRParamsForm = () => {
  const { currStep, numSteps } = useSelector(state => state.factoryWizard)
  const dispatch = useDispatch()

  return (
    <Card title="Choose the item columns and identifiers">
      <Form>
        <Form.Item label={<span>Name</span>}>
          <Input placeholder="Token² Curated List" />
        </Form.Item>
        <Form.Item
          label={
            <span>
              Description&nbsp;
              <Tooltip title="A short sentence describing the what are the the TCR items and its listing criteria.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
        >
          <Input placeholder="A token curated list of tokens powered by Kleros..." />
        </Form.Item>
        <Form.Item
          label={
            <span>
              Registration Deposit&nbsp;
              <Tooltip title="This will be the deposit required to submit or remove an item.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
        >
          <Input addonBefore="ETH" placeholder="0.1 ETH" />
        </Form.Item>
        <Form.Item
          label={
            <span>
              Challenger Deposit&nbsp;
              <Tooltip title="This is the deposit required to challenge a submission or removal request.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
        >
          <Input addonBefore="ETH" placeholder="0.05 ETH" />
        </Form.Item>
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

export default Form.create({ name: 'tcrParamsForm' })(TCRParamsForm)
