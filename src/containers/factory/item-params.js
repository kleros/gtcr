import { Button, Card, Col, Form, Icon, Input, Row, Select } from 'antd'
import React, { useState } from 'react'

const { Option } = Select

const ItemField = ({ k, keys, remove }) => {
  const [type, setType] = useState()
  return (
    <Row gutter={16}>
      <Col span={7}>
        <Input placeholder="Token Ticker" type="text" />
      </Col>
      <Col span={10}>
        <Input
          placeholder="This should be the capitalized token ticker..."
          type="text"
        />
      </Col>
      <Col span={5}>
        <Select onChange={e => setType(e)} value={type}>
          <Option value="address">address</Option>
          <Option value="string">string</Option>
        </Select>
      </Col>
      <Col>
        {keys.length > 1 ? (
          <Icon
            className="dynamic-delete-button"
            onClick={() => remove(k)}
            type="minus-circle-o"
          />
        ) : null}
      </Col>
    </Row>
  )
}

const TCRParamsForm = ({
  form,
  form: { getFieldDecorator, getFieldValue }
}) => {
  const [id, setId] = useState(0)

  const remove = k => {
    const keys = form.getFieldValue('keys')
    if (keys.length === 1) return

    form.setFieldsValue({
      keys: keys.filter(key => key !== k)
    })
  }

  const add = () => {
    const keys = form.getFieldValue('keys')
    const nextKeys = keys.concat(id)
    setId(id + 1)
    form.setFieldsValue({
      keys: nextKeys
    })
  }

  getFieldDecorator('keys', { initialValue: [] })
  const keys = getFieldValue('keys')
  const formItems = keys.map(k => (
    <Form.Item key={k} required={false}>
      <ItemField k={k} keys={keys} remove={remove} />
    </Form.Item>
  ))

  return (
    <Card title="Select the TCR parameters">
      <Form>
        {formItems}
        <Form.Item>
          <Button onClick={add} style={{ width: '60%' }} type="dashed">
            <Icon type="plus" /> Add field
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default Form.create({ name: 'tcrParamsForm' })(TCRParamsForm)
