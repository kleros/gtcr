import React, { useEffect, useState } from 'react'
import styled, { createGlobalStyle } from 'styled-components'
import { BrowserRouter } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import Footer from '../components/footer.tsx'
import Web3Provider from 'web3-react'
import { Layout } from 'antd'
import { unregister } from './service-worker'
import { WalletProvider } from 'contexts/wallet-context'
import { TourProvider } from 'contexts/tour-context'
import { StakeProvider } from 'contexts/stake-context'
import { ThemeProvider } from 'contexts/theme-context'
import WalletModal from 'components/modals/wallet-modal'
import WelcomeModal from 'components/modals/welcome-modal'
import SmartContractWalletWarning from 'components/smart-contract-wallet-warning'
import AppBar from 'components/layout/app-bar'
import AppRouter from './app-router'
import connectors from 'config/connectors'
import 'antd/dist/antd.css'
import './theme.css'
import './fontawesome'

const GlobalStyle = createGlobalStyle`
  /* Only apply body background for dark mode */
  body[data-theme="dark"] {
    background-color: ${({ theme }) => theme.bodyBackground} !important;
    color: ${({ theme }) => theme.textPrimary} !important;
  }

  body {
    transition: background-color 0.3s ease, color 0.3s ease;
  }

  /* Universal styles (both light and dark mode) */
  .ant-descriptions-bordered {
    margin-top: 16px;
  }

  /* Dark mode only - Ant Design overrides */
  body[data-theme="dark"] {
    /* Layout */
    .ant-layout {
      background: ${({ theme }) => theme.bodyBackground} !important;
    }

    /* Card and containers */
    .ant-card {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
    }
    .ant-card-head {
      background: ${({ theme }) => theme.elevatedBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-card-head-title {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-card-body {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-card-actions {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
    }
    .ant-card-actions > li > span > .ant-btn {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-card-actions > li > span > .ant-btn:hover {
      border-color: ${({ theme }) => theme.primaryColor} !important;
      color: ${({ theme }) => theme.primaryColor} !important;
    }

    /* Modal */
    .ant-modal-content {
      background: ${({ theme }) => theme.componentBackground} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-modal-header {
      background: ${({ theme }) => theme.elevatedBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
    }
    .ant-modal-title {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-modal-close-x {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ant-modal-body {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-modal-footer {
      border-color: ${({ theme }) => theme.borderColor} !important;
      background: ${({ theme }) => theme.componentBackground} !important;
    }

    /* Form elements */
    .ant-input {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
      transition: all 0.25s ease !important;
    }
    .ant-input:hover {
      border-color: rgba(95, 173, 219, 0.5) !important;
    }
    .ant-input:focus {
      border-color: ${({ theme }) => theme.primaryColor} !important;
      box-shadow: 0 0 0 2px rgba(95, 173, 219, 0.2) !important;
    }
    .ant-input::placeholder {
      color: ${({ theme }) => theme.textTertiary} !important;
    }
    .ant-input-affix-wrapper {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      transition: all 0.25s ease !important;
    }
    .ant-input-affix-wrapper:hover {
      border-color: rgba(95, 173, 219, 0.5) !important;
    }
    .ant-input-affix-wrapper:focus,
    .ant-input-affix-wrapper-focused {
      border-color: ${({ theme }) => theme.primaryColor} !important;
      box-shadow: 0 0 0 2px rgba(95, 173, 219, 0.2) !important;
    }
    .ant-input-group-addon {
      background: ${({ theme }) => theme.elevatedBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
    }

    /* Select - Ant Design v3 */
    .ant-select-selection {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
      transition: all 0.25s ease !important;
    }
    .ant-select-selection:hover {
      border-color: rgba(95, 173, 219, 0.5) !important;
    }
    .ant-select-focused .ant-select-selection,
    .ant-select-open .ant-select-selection {
      border-color: ${({ theme }) => theme.primaryColor} !important;
      box-shadow: 0 0 0 2px rgba(95, 173, 219, 0.2) !important;
    }
    .ant-select-selection__rendered {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-select-selection__placeholder {
      color: ${({ theme }) => theme.textTertiary} !important;
    }
    .ant-select-arrow {
      color: ${({ theme }) => theme.textSecondary} !important;
      transition: transform 0.25s ease !important;
    }
    .ant-select-open .ant-select-arrow {
      transform: rotate(180deg);
    }
    .ant-select-dropdown {
      background: ${({ theme }) => theme.componentBackground} !important;
      border: 1px solid ${({ theme }) => theme.borderColor} !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(95, 173, 219, 0.1) !important;
    }
    .ant-select-dropdown-menu-item {
      color: ${({ theme }) => theme.textPrimary} !important;
      transition: all 0.2s ease !important;
    }
    .ant-select-dropdown-menu-item:hover {
      background: rgba(95, 173, 219, 0.1) !important;
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-select-dropdown-menu-item-active {
      background: rgba(95, 173, 219, 0.08) !important;
    }
    .ant-select-dropdown-menu-item-selected {
      background: rgba(95, 173, 219, 0.15) !important;
      color: ${({ theme }) => theme.primaryColor} !important;
      font-weight: 500;
    }
    /* Select - Ant Design v4 (fallback) */
    .ant-select-selector {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-select-selection-item {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-select-item {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
      background: ${({ theme }) => theme.elevatedBackground} !important;
    }
    .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
      background: ${({ theme }) => theme.quaternaryColor} !important;
    }

    /* Table */
    .ant-table {
      background: ${({ theme }) => theme.componentBackground} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-table-thead > tr > th {
      background: ${({ theme }) => theme.elevatedBackground} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
    }
    .ant-table-tbody > tr > td {
      border-color: ${({ theme }) => theme.borderColor} !important;
    }
    .ant-table-tbody > tr:hover > td {
      background: ${({ theme }) => theme.elevatedBackground} !important;
    }
    .ant-table-placeholder {
      background: ${({ theme }) => theme.componentBackground} !important;
    }
    .ant-empty-description {
      color: ${({ theme }) => theme.textSecondary} !important;
    }

    /* Buttons */
    .ant-btn {
      transition: all 0.25s ease !important;
    }
    .ant-btn-primary {
      background-color: ${({ theme }) => theme.primaryColor} !important;
      border-color: ${({ theme }) => theme.primaryColor} !important;
      color: ${({ theme }) => theme.textOnPrimary} !important;
      box-shadow: 0 2px 8px rgba(95, 173, 219, 0.3) !important;
    }
    .ant-btn-primary:hover,
    .ant-btn-primary:focus {
      background-color: ${({ theme }) => theme.primaryColorHover} !important;
      border-color: ${({ theme }) => theme.primaryColorHover} !important;
      color: ${({ theme }) => theme.textOnPrimary} !important;
      box-shadow: 0 4px 16px rgba(124, 196, 232, 0.4) !important;
      transform: translateY(-1px);
    }
    .ant-btn-primary:active {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(95, 173, 219, 0.3) !important;
    }
    .ant-btn:not(.ant-btn-primary):not(.ant-btn-link):not(.ant-btn-ghost) {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-btn:not(.ant-btn-primary):not(.ant-btn-link):not(.ant-btn-ghost):hover {
      border-color: ${({ theme }) => theme.primaryColor} !important;
      color: ${({ theme }) => theme.primaryColor} !important;
      background: ${({ theme }) => theme.elevatedBackground} !important;
      box-shadow: 0 2px 8px rgba(95, 173, 219, 0.15) !important;
    }

    /* Switch */
    .ant-switch {
      background-color: ${({ theme }) =>
        theme.name === 'dark' ? '#2d2840' : 'rgba(0, 0, 0, 0.25)'} !important;
      transition: all 0.25s ease !important;
    }
    .ant-switch::after,
    .ant-switch-handle::before {
      background-color: #ffffff !important;
    }
    .ant-switch:hover {
      box-shadow: 0 0 8px ${({ theme }) =>
        theme.name === 'dark'
          ? 'rgba(95, 173, 219, 0.4)'
          : 'rgba(104, 38, 191, 0.4)'} !important;
    }
    .ant-switch-checked {
      background-color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-switch-checked:hover {
      background-color: ${({ theme }) =>
        theme.name === 'dark' ? theme.primaryColorHover : '#7c3aed'} !important;
    }
    .ant-switch-inner {
      color: ${({ theme }) =>
        theme.name === 'dark' ? '#ffffff' : 'inherit'} !important;
    }
    .ant-switch-checked .ant-switch-inner {
      color: ${({ theme }) => theme.textOnPrimary} !important;
    }

    /* List */
    .ant-list {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-list-item {
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
      transition: all 0.2s ease !important;
    }
    .ant-list-item:hover {
      background: rgba(95, 173, 219, 0.05) !important;
    }
    .ant-list-item-meta-title {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-list-item-meta-description {
      color: ${({ theme }) => theme.textSecondary} !important;
    }

    /* Popover */
    .ant-popover-inner {
      background: ${({ theme }) => theme.componentBackground} !important;
      box-shadow: 0 4px 16px ${({ theme }) =>
        theme.name === 'dark'
          ? 'rgba(0, 0, 0, 0.5)'
          : 'rgba(188, 156, 255, 0.3)'} !important;
      border: 1px solid ${({ theme }) => theme.borderColor} !important;
    }
    .ant-popover-title {
      color: ${({ theme }) => theme.textPrimary} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
    }
    .ant-popover-inner-content {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-popover-arrow {
      border-color: ${({ theme }) => theme.borderColor} !important;
    }
    .ant-popover-arrow::after {
      border-color: ${({ theme }) => theme.componentBackground} !important;
    }

    /* Tooltip */
    .ant-tooltip-inner {
      background: ${({ theme }) => theme.elevatedBackground} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
    }

    /* Dropdown */
    .ant-dropdown-menu {
      background: ${({ theme }) => theme.componentBackground} !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5) !important;
      border: 1px solid ${({ theme }) => theme.borderColor} !important;
    }
    .ant-dropdown-menu-item {
      color: ${({ theme }) => theme.textPrimary} !important;
      transition: all 0.2s ease !important;
    }
    .ant-dropdown-menu-item:hover {
      background: rgba(95, 173, 219, 0.1) !important;
      color: ${({ theme }) => theme.primaryColor} !important;
    }

    /* Tabs */
    .ant-tabs-tab {
      color: ${({ theme }) => theme.textSecondary} !important;
      transition: all 0.25s ease !important;
    }
    .ant-tabs-tab:hover {
      color: ${({ theme }) => theme.primaryColor} !important;
      text-shadow: 0 0 8px rgba(95, 173, 219, 0.3);
    }
    .ant-tabs-tab-active,
    .ant-tabs-tab-active .ant-tabs-tab-btn {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-tabs-ink-bar {
      background: ${({ theme }) => theme.primaryColor} !important;
    }

    /* Form */
    .ant-form {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-form-item-label > label {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-form-item-label > label .anticon {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ant-form-item-explain {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ant-form .anticon-question-circle-o,
    .ant-form .anticon-question-circle {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ant-form span {
      color: ${({ theme }) => theme.textPrimary};
    }

    /* Tag */
    .ant-tag {
      background: ${({ theme }) => theme.elevatedBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }
    .ant-tag:hover {
      border-color: rgba(95, 173, 219, 0.5) !important;
      box-shadow: 0 0 8px rgba(95, 173, 219, 0.2) !important;
    }
    .ant-tag-checkable:not(.ant-tag-checkable-checked) {
      background: ${({ theme }) => theme.elevatedBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
      cursor: pointer;
    }
    .ant-tag-checkable:not(.ant-tag-checkable-checked):hover {
      color: ${({ theme }) => theme.textPrimary} !important;
      border-color: ${({ theme }) => theme.textSecondary} !important;
      background: ${({ theme }) => theme.elevatedBackground} !important;
    }
    .ant-tag-checkable-checked {
      background: ${({ theme }) => theme.primaryColor} !important;
      border-color: ${({ theme }) => theme.primaryColor} !important;
      color: ${({ theme }) => theme.textOnPrimary} !important;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }
    .ant-tag-checkable-checked:hover {
      background: ${({ theme }) => theme.primaryColorHover} !important;
      border-color: ${({ theme }) => theme.primaryColorHover} !important;
      color: ${({ theme }) => theme.textOnPrimary} !important;
    }

    /* Spin / Loading */
    .ant-spin-text {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ant-spin-dot-item {
      background-color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-spin-nested-loading > div > .ant-spin {
      max-height: none;
    }
    .ant-spin-container::after {
      background: ${({ theme }) => theme.bodyBackground} !important;
    }

    /* Alert */
    .ant-alert {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-alert-info {
      background: ${({ theme }) => theme.elevatedBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
    }
    .ant-alert-message {
      color: ${({ theme }) => theme.textPrimary} !important;
    }

    /* Pagination */
    .ant-pagination-item {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      transition: all 0.25s ease !important;
    }
    .ant-pagination-item:hover {
      border-color: ${({ theme }) => theme.primaryColor} !important;
      background: rgba(95, 173, 219, 0.08) !important;
      transform: translateY(-1px);
    }
    .ant-pagination-item:hover a {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-pagination-item a {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-pagination-item-active {
      border-color: ${({ theme }) => theme.primaryColor} !important;
      background: rgba(95, 173, 219, 0.15) !important;
    }
    .ant-pagination-item-active a {
      color: ${({ theme }) => theme.primaryColor} !important;
      font-weight: 500;
    }
    .ant-pagination-prev,
    .ant-pagination-next {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-pagination-prev span,
    .ant-pagination-next span {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    /* Disabled state (e.g., Previous on page 1, Next on last page) */
    .ant-pagination-disabled,
    .ant-pagination-disabled:hover {
      opacity: 0.3 !important;
      cursor: not-allowed !important;
    }
    .ant-pagination-disabled span,
    .ant-pagination-disabled:hover span {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ant-pagination-disabled .ant-pagination-item-link,
    .ant-pagination-disabled:hover .ant-pagination-item-link {
      color: ${({ theme }) => theme.textSecondary} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      background: ${({ theme }) => theme.componentBackground} !important;
    }
    .ant-pagination-prev:hover,
    .ant-pagination-next:hover {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-pagination-prev:hover span,
    .ant-pagination-next:hover span {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-pagination-prev .ant-pagination-item-link,
    .ant-pagination-next .ant-pagination-item-link {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
      transition: all 0.25s ease !important;
    }
    .ant-pagination-prev:hover .ant-pagination-item-link,
    .ant-pagination-next:hover .ant-pagination-item-link {
      border-color: ${({ theme }) => theme.primaryColor} !important;
      color: ${({ theme }) => theme.primaryColor} !important;
      background: rgba(95, 173, 219, 0.08) !important;
    }
    /* Jump prev/next (« ») */
    .ant-pagination-jump-prev,
    .ant-pagination-jump-next {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-pagination-jump-prev .ant-pagination-item-link,
    .ant-pagination-jump-next .ant-pagination-item-link {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-pagination-jump-prev:hover .ant-pagination-item-link,
    .ant-pagination-jump-next:hover .ant-pagination-item-link {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    /* Hide ellipsis, show arrow icons always */
    .ant-pagination-jump-prev .ant-pagination-item-container .ant-pagination-item-ellipsis,
    .ant-pagination-jump-next .ant-pagination-item-container .ant-pagination-item-ellipsis {
      display: none !important;
    }
    .ant-pagination-jump-prev .ant-pagination-item-container .ant-pagination-item-link-icon,
    .ant-pagination-jump-next .ant-pagination-item-container .ant-pagination-item-link-icon {
      opacity: 1 !important;
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-pagination-jump-prev:hover .ant-pagination-item-container .ant-pagination-item-link-icon,
    .ant-pagination-jump-next:hover .ant-pagination-item-container .ant-pagination-item-link-icon {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-pagination-simple .ant-pagination-simple-pager input {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
    }

    /* Breadcrumb */
    .ant-breadcrumb {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ant-breadcrumb a {
      color: ${({ theme }) => theme.textSecondary} !important;
      transition: all 0.2s ease !important;
    }
    .ant-breadcrumb a:hover {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-breadcrumb-separator {
      color: ${({ theme }) => theme.textTertiary} !important;
    }

    /* Checkbox */
    .ant-checkbox-inner {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      transition: all 0.2s ease !important;
    }
    .ant-checkbox-wrapper:hover .ant-checkbox-inner,
    .ant-checkbox:hover .ant-checkbox-inner {
      border-color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-checkbox-checked .ant-checkbox-inner {
      background: ${({ theme }) => theme.primaryColor} !important;
      border-color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-checkbox-checked:hover .ant-checkbox-inner {
      background: #7cc4e8 !important;
      border-color: #7cc4e8 !important;
    }

    /* Radio */
    .ant-radio-inner {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      transition: all 0.2s ease !important;
    }
    .ant-radio-wrapper:hover .ant-radio-inner,
    .ant-radio:hover .ant-radio-inner {
      border-color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-radio-checked .ant-radio-inner {
      border-color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-radio-checked .ant-radio-inner::after {
      background: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-radio-checked:hover .ant-radio-inner {
      border-color: #7cc4e8 !important;
    }
    .ant-radio-checked:hover .ant-radio-inner::after {
      background: #7cc4e8 !important;
    }

    /* Collapse */
    .ant-collapse {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      box-shadow: none !important;
    }
    .ant-collapse-item {
      border-color: ${({ theme }) => theme.borderColor} !important;
    }
    .ant-collapse-header {
      color: ${({ theme }) => theme.textPrimary} !important;
      transition: all 0.25s ease !important;
    }
    .ant-collapse-header:hover {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-collapse-content {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
    }

    /* Divider */
    .ant-divider {
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ant-divider-inner-text {
      color: ${({ theme }) => theme.textSecondary} !important;
    }

    /* Skeleton */
    .ant-skeleton-content .ant-skeleton-title,
    .ant-skeleton-content .ant-skeleton-paragraph > li {
      background: ${({ theme }) => theme.elevatedBackground} !important;
    }

    /* Steps */
    .ant-steps-item-title {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-steps-item-description {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ant-steps-item-tail::after {
      background: ${({ theme }) => theme.borderColor} !important;
    }
    .ant-steps-item-finish .ant-steps-item-tail::after {
      background: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-steps-item-wait .ant-steps-item-icon {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
    }
    .ant-steps-item-wait .ant-steps-item-icon > .ant-steps-icon {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ant-steps-item-process .ant-steps-item-icon {
      background: ${({ theme }) => theme.primaryColor} !important;
      border-color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-steps-item-process .ant-steps-item-icon > .ant-steps-icon {
      color: ${({ theme }) =>
        theme.name === 'dark' ? theme.textOnPrimary : '#0d0a14'} !important;
    }
    .ant-steps-item-finish .ant-steps-item-icon {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-steps-item-finish .ant-steps-item-icon > .ant-steps-icon {
      color: ${({ theme }) => theme.primaryColor} !important;
    }

    /* Slider */
    .ant-slider-rail {
      background: ${({ theme }) => theme.elevatedBackground} !important;
    }
    .ant-slider-track {
      background: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-slider-handle {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-slider-handle:focus {
      box-shadow: 0 0 0 5px ${({ theme }) =>
        theme.name === 'dark'
          ? 'rgba(95, 173, 219, 0.2)'
          : 'rgba(104, 38, 191, 0.2)'} !important;
    }

    /* InputNumber */
    .ant-input-number {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-input-number-handler-wrap {
      background: ${({ theme }) => theme.elevatedBackground} !important;
    }
    .ant-input-number-handler {
      border-color: ${({ theme }) => theme.borderColor} !important;
    }
    .ant-input-number-handler:hover .ant-input-number-handler-up-inner,
    .ant-input-number-handler:hover .ant-input-number-handler-down-inner {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-input-number-handler-up-inner,
    .ant-input-number-handler-down-inner {
      color: ${({ theme }) => theme.textSecondary} !important;
    }

    /* Upload */
    .ant-upload.ant-upload-select-picture-card {
      background: ${({ theme }) => theme.elevatedBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-upload.ant-upload-select-picture-card:hover {
      border-color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-upload.ant-upload-select-picture-card .anticon {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    .ant-upload-picture-card-wrapper {
      color: ${({ theme }) => theme.textPrimary} !important;
    }

    /* Timeline */
    .ant-timeline-item-content {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-timeline-item-tail {
      border-left-color: ${({ theme }) => theme.borderColor} !important;
    }
    .ant-timeline-item-head {
      background: ${({ theme }) => theme.componentBackground} !important;
    }
    .ant-timeline-item-head-custom {
      background: transparent !important;
    }
    .ant-timeline-item-head-custom .anticon {
      color: ${({ theme }) =>
        theme.name === 'dark' ? theme.textSecondary : '#4d00b4'} !important;
      font-size: 18px;
    }

    /* Typography */
    .ant-typography {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    h1.ant-typography, h2.ant-typography, h3.ant-typography, h4.ant-typography, h5.ant-typography {
      color: ${({ theme }) => theme.textPrimary} !important;
    }

    /* Result */
    .ant-result-title {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-result-subtitle {
      color: ${({ theme }) => theme.textSecondary} !important;
    }

    /* Upload */
    .ant-upload-drag {
      background: ${({ theme }) => theme.componentBackground} !important;
      border-color: ${({ theme }) => theme.borderColor} !important;
    }
    .ant-upload-text {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-upload-hint {
      color: ${({ theme }) => theme.textSecondary} !important;
    }

    /* Menu */
    .ant-menu {
      background: transparent !important;
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-menu-horizontal {
      background: transparent !important;
      border-bottom: none !important;
    }
    .ant-menu-horizontal > .ant-menu-item {
      background: transparent !important;
    }
    .ant-menu-item {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-menu-item:hover {
      background: transparent !important;
    }
    .ant-menu-item a {
      color: #fff !important;
    }
    .ant-menu-item a:hover {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    /* Dropdown menu (non-horizontal) */
    .ant-dropdown .ant-menu {
      background: ${({ theme }) => theme.componentBackground} !important;
    }
    .ant-dropdown .ant-menu-item:hover {
      background: ${({ theme }) => theme.elevatedBackground} !important;
    }

    /* Progress */
    .ant-progress-text {
      color: ${({ theme }) => theme.textPrimary} !important;
    }

    /* Descriptions */
    .ant-descriptions-item-label {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ant-descriptions-item-content {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-descriptions-bordered .ant-descriptions-view {
      border-color: ${({ theme }) => theme.borderColor} !important;
    }
    .ant-descriptions-bordered .ant-descriptions-item-label,
    .ant-descriptions-bordered .ant-descriptions-item-content {
      border-color: ${({ theme }) => theme.borderColor} !important;
      background: ${({ theme }) => theme.elevatedBackground} !important;
    }

    /* Theme color class overrides for dark mode */
    .quaternary-background.theme-background,
    .quaternary-background .theme-background {
      background: ${({ theme }) => theme.elevatedBackground} !important;
    }
    .quaternary-color.theme-color,
    .quaternary-color .theme-color {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ternary-color.theme-color,
    .ternary-color .theme-color {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .secondary-color.theme-color,
    .secondary-color .theme-color {
      color: ${({ theme }) => theme.textTertiary} !important;
    }
    .primary-color.theme-color,
    .primary-color .theme-color {
      color: ${({ theme }) => theme.primaryColor} !important;
    }

    /* Global link styles */
    a {
      color: ${({ theme }) => theme.linkColor};
      transition: color 0.2s ease;
    }
    a:hover {
      color: #7cc4e8;
    }

    /* Upload hover effect */
    .ant-upload-drag:hover {
      border-color: ${({ theme }) => theme.primaryColor} !important;
    }

    /* Modal close button hover */
    .ant-modal-close:hover .ant-modal-close-x {
      color: ${({ theme }) => theme.primaryColor} !important;
    }

    /* Table row hover improvement */
    .ant-table-tbody > tr:hover > td {
      background: rgba(95, 173, 219, 0.08) !important;
    }

    /* Notification */
    .ant-notification-notice {
      background: ${({ theme }) => theme.componentBackground} !important;
      border: 1px solid ${({ theme }) => theme.borderColor} !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5) !important;
      border-radius: 8px !important;
    }
    .ant-notification-notice-message {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .ant-notification-notice-description {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ant-notification-notice-close {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .ant-notification-notice-close:hover {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    /* Notification icons - brighter for dark mode */
    .anticon.ant-notification-notice-icon-success {
      color: ${({ theme }) => theme.successColor} !important;
    }
    .anticon.ant-notification-notice-icon-error {
      color: ${({ theme }) => theme.errorColor} !important;
    }
    .anticon.ant-notification-notice-icon-warning {
      color: ${({ theme }) => theme.warningColor} !important;
    }
    .anticon.ant-notification-notice-icon-info {
      color: ${({ theme }) => theme.infoColor} !important;
    }

    /* Message (toast notifications) */
    .ant-message-notice-content {
      background: ${({ theme }) => theme.componentBackground} !important;
      border: 1px solid ${({ theme }) => theme.borderColor} !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5) !important;
      color: ${({ theme }) => theme.textPrimary} !important;
      border-radius: 8px !important;
    }
    .ant-message-custom-content span {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    /* Message icons - brighter for dark mode */
    .ant-message-success .anticon {
      color: ${({ theme }) => theme.successColor} !important;
    }
    .ant-message-error .anticon {
      color: ${({ theme }) => theme.errorColor} !important;
    }
    .ant-message-warning .anticon {
      color: ${({ theme }) => theme.warningColor} !important;
    }
    .ant-message-info .anticon,
    .ant-message-loading .anticon {
      color: ${({ theme }) => theme.infoColor} !important;
    }

    /* Reactour (Tour/Guide modal) */
    .reactour__helper {
      background: ${({ theme }) => theme.componentBackground} !important;
      color: ${({ theme }) => theme.textPrimary} !important;
      border-radius: 12px !important;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6) !important;
    }
    .reactour__helper div {
      color: ${({ theme }) => theme.textPrimary} !important;
    }
    .reactour__helper a {
      color: ${({ theme }) => theme.linkColor} !important;
    }
    .reactour__helper a:hover {
      color: #7cc4e8 !important;
    }
    .reactour__close {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    .reactour__close:hover {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    .reactour__dot {
      background: ${({ theme }) => theme.borderColor} !important;
      border: none !important;
    }
    .reactour__dot--is-active {
      background: ${({ theme }) => theme.primaryColor} !important;
    }
    [data-tour-elem="left-arrow"],
    [data-tour-elem="right-arrow"] {
      color: ${({ theme }) => theme.textSecondary} !important;
    }
    [data-tour-elem="left-arrow"]:hover,
    [data-tour-elem="right-arrow"]:hover {
      color: ${({ theme }) => theme.primaryColor} !important;
    }
    [data-tour-elem="badge"] {
      background: ${({ theme }) => theme.primaryColor} !important;
      color: ${({ theme }) => theme.textOnPrimary} !important;
    }
  }
`

const StyledClickaway = styled.div`
  background-color: black;
  position: fixed;
  width: 100%;
  height: 100%;
  opacity: ${properties => (properties.isMenuClosed ? 0 : 0.4)};
  transition: opacity 0.3s;
  pointer-events: ${properties => (properties.isMenuClosed ? 'none' : 'auto')};
`

const StyledLayout = styled(Layout)`
  min-height: 100vh !important;
  background: ${({ theme }) => theme.bodyBackground} !important;
`

const FooterWrapper = styled.div`
  margin-top: auto !important;
`

const App = () => {
  const [isMenuClosed, setIsMenuClosed] = useState(true)

  // this useEffect redirects the URL to a correct one in case Court sent you to an incorrect URL using old ?chainId= syntax
  useEffect(() => {
    const url = window.location.href
    let tcrAddress, itemId, chainId

    if (url.includes('?chainId=')) {
      tcrAddress = url.split('/')[4]
      itemId = url.split('/')[5].split('?')[0]
      chainId = url.split('=')[1]
      const redirectUrl = url.replace(
        `/tcr/${tcrAddress}/${itemId}?chainId=${chainId}`,
        `/tcr/${chainId}/${tcrAddress}/${itemId}`
      )
      window.location.replace(redirectUrl)
    }
  }, [])

  return (
    <ThemeProvider>
      <GlobalStyle />
      <Web3Provider connectors={connectors} libraryName="ethers.js">
        <BrowserRouter>
          <TourProvider>
            <WalletProvider>
              <Helmet>
                <title>Kleros · Curate</title>
                <link
                  href="https://fonts.googleapis.com/css?family=Roboto:400,400i,500,500i,700,700i"
                  rel="stylesheet"
                />
              </Helmet>
              <StakeProvider>
                <StyledLayout>
                  <Layout>
                    <SmartContractWalletWarning />
                    <AppBar />
                    <AppRouter />
                    <StyledClickaway
                      isMenuClosed={isMenuClosed}
                      onClick={
                        isMenuClosed ? null : () => setIsMenuClosed(true)
                      }
                    />
                  </Layout>
                </StyledLayout>
              </StakeProvider>
              <FooterWrapper>
                <Footer />
              </FooterWrapper>
              <WalletModal connectors={connectors} />
              <WelcomeModal />
            </WalletProvider>
          </TourProvider>
        </BrowserRouter>
      </Web3Provider>
    </ThemeProvider>
  )
}

export default App

// Unregister service worker to prevent aggressive caching.
// This ensures users always get the latest version without needing to clear cache.
unregister()
