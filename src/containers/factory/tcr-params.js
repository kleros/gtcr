import { Card, Form, Icon, Input, Tooltip } from 'antd'
import React from 'react'

const TCRParamsForm = () => {
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
      </Form>
    </Card>
  )
}

export default Form.create({ name: 'tcrParamsForm' })(TCRParamsForm)
