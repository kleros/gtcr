import React, { useContext } from 'react'
import styled from 'styled-components'
import { responsiveSize } from 'styles/responsive-size'
import { Modal, Divider, Typography } from 'antd'
import { ReactComponent as Logo } from 'assets/images/logo2.svg'
import { ReactComponent as List } from 'assets/images/infographic/list.svg'
import { ReactComponent as Kleros } from 'assets/images/infographic/kleros.svg'
import { ReactComponent as Scale } from 'assets/images/infographic/scale.svg'
import { TourContext } from 'contexts/tour-context'

const { Title, Paragraph } = Typography

const StyledModal = styled(Modal)`
  width: 80% !important;
  text-align: center;

  & > .ant-modal-content {
    border-radius: 24px;
    box-shadow: 0px 6px 36px #bc9cff;

    & > .ant-modal-body {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    & > .ant-modal-close {
      color: #6826bf;
    }
  }
`

const InfographContainer = styled.div`
  display: flex;
  justify-content: space-around;
  width: 100%;
  flex-wrap: wrap;
`

const Infograph = styled.div`
  width: 250px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`

const ResponsiveIframe = styled.iframe`
  width: ${responsiveSize(260, 900)};
  height: ${responsiveSize(150, 500)};
`

const StyledCurateLogo = styled.div`
  height: ${responsiveSize(100, 140)};
`

const WelcomeModal = () => {
  const { welcomeModalDismissed, dismissWelcomeModal } = useContext(TourContext)

  return (
    <StyledModal
      visible={!welcomeModalDismissed}
      footer={null}
      onCancel={dismissWelcomeModal}
    >
      <Title>Welcome to Kleros Curate</Title>
      <Paragraph>
        Create your own lists, contribute to other people's lists and put
        information in the hands of communities.
      </Paragraph>
      <StyledCurateLogo>
        <Logo style={{ width: '100%', height: '100%' }} />
      </StyledCurateLogo>
      {process.env.REACT_APP_INSTRUCTION_VIDEO && (
        <>
          <Divider />
          <Paragraph>Check this video tutorial before starting</Paragraph>
          <ResponsiveIframe
            title="instructions"
            width="560"
            height="315"
            src={process.env.REACT_APP_INSTRUCTION_VIDEO}
            frameborder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          />
        </>
      )}
      <Divider />
      <InfographContainer>
        <Infograph>
          <List style={{ width: '100px', height: '100px', margin: '24px' }} />
          <Title level={4}>A World of Lists</Title>
          <Paragraph>
            What tokens to list in an exchange? What items accept in a
            marketplace? Which content remove in a social media platform? All
            these are problems of list curation.
          </Paragraph>
        </Infograph>
        <Infograph>
          <Kleros style={{ width: '100px', height: '100px', margin: '24px' }} />
          <Title level={4}>Empower Your Community</Title>
          <Paragraph>
            Create a list, define guidelines and put curation in the hands of
            the community.
          </Paragraph>
        </Infograph>
        <Infograph>
          <Scale style={{ width: '100px', height: '100px', margin: '24px' }} />
          <Title level={4}>Fairness and Transparency</Title>
          <Paragraph>
            Kleros will make sure that the curation decisions are done in a fair
            and transparent way.
          </Paragraph>
        </Infograph>
      </InfographContainer>
    </StyledModal>
  )
}

export default WelcomeModal
