import _ from 'intl'
import ActionButton from 'action-button'
import moment from 'moment-timezone'
import React from 'react'
import Scheduler, { SchedulePreview } from 'scheduling'
import { Card, CardBlock } from 'card'
import { generateRandomId } from 'utils'
import { injectState, provideState } from '@julien-f/freactal'
import { isEqual } from 'lodash'

import { FormFeedback, FormGroup, Number } from './utils'

export default [
  injectState,
  provideState({
    initialState: ({
      copyMode,
      exportMode,
      snapshotMode,
      schedule: {
        copyRetention = copyMode ? 1 : undefined,
        cron = '0 0 * * *',
        exportRetention = exportMode ? 1 : undefined,
        name = '',
        snapshotRetention = snapshotMode ? 1 : undefined,
        timezone = moment.tz.guess(),
      },
    }) => ({
      copyRetention,
      cron,
      exportRetention,
      formId: generateRandomId(),
      inputNameId: generateRandomId(),
      name,
      snapshotRetention,
      timezone,
    }),
    effects: {
      setExportRetention: (_, value) => state => ({
        ...state,
        exportRetention: value,
      }),
      setCopyRetention: (_, value) => state => ({
        ...state,
        copyRetention: value,
      }),
      setSnapshotRetention: (_, value) => state => ({
        ...state,
        snapshotRetention: value,
      }),
      setSchedule: (_, { cronPattern, timezone }) => state => ({
        ...state,
        cron: cronPattern,
        timezone,
      }),
      setName: (_, { target: { value } }) => state => ({
        ...state,
        name: value,
      }),
    },
    computed: {
      isScheduleInvalid: ({ retentionNeeded, scheduleNotEdited }) =>
        retentionNeeded || scheduleNotEdited,
      retentionNeeded: ({
        exportMode,
        exportRetention,
        copyMode,
        copyRetention,
        computedSnapshotMode,
        snapshotRetention,
      }) =>
        !(
          (exportMode && exportRetention > 0) ||
          (copyMode && copyRetention > 0) ||
          (computedSnapshotMode && snapshotRetention > 0)
        ),
      scheduleNotEdited: (
        {
          cron,
          editionMode,
          exportRetention,
          copyRetention,
          snapshotRetention,
          timezone,
          name,
        },
        { schedule }
      ) =>
        editionMode !== 'creation' &&
        isEqual(
          {
            cron: schedule.cron,
            exportRetention: schedule.exportRetention,
            copyRetention: schedule.copyRetention,
            snapshotRetention: schedule.snapshotRetention,
            timezone: schedule.timezone,
            name: schedule.name,
          },
          {
            cron,
            exportRetention,
            copyRetention,
            snapshotRetention,
            timezone,
            name,
          }
        ),
    },
  }),
  injectState,
  ({ effects, state }) => (
    <form id={state.formId}>
      <FormFeedback
        component={Card}
        error={state.retentionNeeded}
        message={_('retentionNeeded')}
      >
        <CardBlock>
          <FormGroup>
            <label htmlFor={state.inputNameId}>
              <strong>{_('formName')}</strong>{' '}
            </label>
            <input
              className='form-control'
              id={state.inputNameId}
              onChange={effects.setName}
              type='text'
              value={state.name}
            />
          </FormGroup>
          {state.exportMode && (
            <FormGroup>
              <label>
                <strong>{_('exportRetention')}</strong>
              </label>
              <Number
                onChange={effects.setExportRetention}
                value={state.exportRetention}
                optional
              />
            </FormGroup>
          )}
          {state.copyMode && (
            <FormGroup>
              <label>
                <strong>{_('copyRetention')}</strong>
              </label>
              <Number
                onChange={effects.setCopyRetention}
                value={state.copyRetention}
                optional
              />
            </FormGroup>
          )}
          {state.computedSnapshotMode && (
            <FormGroup>
              <label>
                <strong>{_('snapshotRetention')}</strong>
              </label>
              <Number
                onChange={effects.setSnapshotRetention}
                value={state.snapshotRetention}
                optional
              />
            </FormGroup>
          )}
          <Scheduler
            onChange={effects.setSchedule}
            cronPattern={state.cron}
            timezone={state.timezone}
          />
          <SchedulePreview cronPattern={state.cron} timezone={state.timezone} />
          <br />
          <ActionButton
            btnStyle='primary'
            data-cron={state.cron}
            data-exportRetention={state.exportRetention}
            data-copyRetention={state.copyRetention}
            data-snapshotRetention={state.snapshotRetention}
            data-timezone={state.timezone}
            data-name={state.name}
            disabled={state.isScheduleInvalid}
            form={state.formId}
            handler={effects.saveSchedule}
            icon='save'
            size='large'
          >
            {_('formSave')}
          </ActionButton>
          <ActionButton
            className='pull-right'
            handler={effects.cancelSchedule}
            icon='cancel'
            size='large'
          >
            {_('formCancel')}
          </ActionButton>
        </CardBlock>
      </FormFeedback>
    </form>
  ),
].reduceRight((value, decorator) => decorator(value))
