import React from 'react'
import PropTypes from 'prop-types'
import { Card, Descriptions, Icon, Tooltip } from 'antd'

const ItemPreview = ({ columns }) => (
  <Card title="Preview">
    <Descriptions>
      {columns.map((column, index) => (
        <Descriptions.Item
          key={index}
          label={
            <span>
              {column.label}&nbsp;
              <Tooltip title={column.description}>
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
        >
          {column.type === 'boolean' ? 'true' : 'XYZ'}
        </Descriptions.Item>
      ))}
    </Descriptions>
  </Card>
)

ItemPreview.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired
    })
  ).isRequired
}

export default ItemPreview
