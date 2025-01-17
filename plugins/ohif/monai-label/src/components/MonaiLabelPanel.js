import React, { Component } from 'react';
import PropTypes from 'prop-types';

import './MonaiLabelPanel.styl';
import SegmentationList from './SegmentationList';
import MonaiLabelClient from '../services/MonaiLabelClient';
import { UINotificationService } from '@ohif/core';
import { getImageIdsForDisplaySet } from '../utils/SegmentationUtils';
import cornerstone from 'cornerstone-core';
import MD5 from 'md5.js';
import AutoSegmentation from './actions/AutoSegmentation';
import SmartEdit from './actions/SmartEdit';
import OptionTable from './actions/OptionTable';
import ActiveLearning from './actions/ActiveLearning';
import SettingsTable from './SettingsTable';

export default class MonaiLabelPanel extends Component {
  static propTypes = {
    studies: PropTypes.any,
    viewports: PropTypes.any,
    activeIndex: PropTypes.any,
  };

  constructor(props) {
    super(props);

    const { viewports, studies, activeIndex } = props;
    this.viewConstants = this.getViewConstants(viewports, studies, activeIndex);
    console.debug(this.viewConstants);

    this.notification = UINotificationService.create({});
    this.segmentationList = React.createRef();
    this.settings = React.createRef();
    this.actions = {
      options: React.createRef(),
      activelearning: React.createRef(),
      segmentation: React.createRef(),
      smartedit: React.createRef(),
    };

    this.state = {
      info: {},
      action: {},
    };
  }

  async componentDidMount() {
    await this.onInfo();
  }

  client = () => {
    const settings =
      this.settings && this.settings.current && this.settings.current.state
        ? this.settings.current.state
        : null;
    return new MonaiLabelClient(
      settings ? settings.url : 'http://127.0.0.1:8000'
    );
  };

  getViewConstants = (viewports, studies, activeIndex) => {
    const viewport = viewports[activeIndex];
    const { PatientID } = studies[activeIndex];

    const {
      StudyInstanceUID,
      SeriesInstanceUID,
      displaySetInstanceUID,
    } = viewport;

    const imageIds = getImageIdsForDisplaySet(
      studies,
      StudyInstanceUID,
      SeriesInstanceUID
    );
    const imageIdsToIndex = new Map();
    for (let i = 0; i < imageIds.length; i++) {
      imageIdsToIndex.set(imageIds[i], i);
    }

    const element = cornerstone.getEnabledElements()[this.props.activeIndex]
      .element;
    const cookiePostfix = new MD5()
      .update(PatientID + StudyInstanceUID + SeriesInstanceUID)
      .digest('hex');

    return {
      PatientID: PatientID,
      StudyInstanceUID: StudyInstanceUID,
      SeriesInstanceUID: SeriesInstanceUID,
      displaySetInstanceUID: displaySetInstanceUID,
      imageIdsToIndex: imageIdsToIndex,
      element: element,
      numberOfFrames: imageIds.length,
      cookiePostfix: cookiePostfix,
    };
  };

  onInfo = async () => {
    const response = await this.client().info();
    if (response.status !== 200) {
      this.notification.show({
        title: 'MONAI Label',
        message: 'Failed to Connect to MONAI Label Server',
        type: 'error',
        duration: 5000,
      });
    } else {
      this.notification.show({
        title: 'MONAI Label',
        message: 'Connected to MONAI Label Server - Successful',
        type: 'success',
        duration: 2000,
      });

      this.setState({ info: response.data });
    }
  };

  onSegmentCreated = id => {
    console.info('Segment Created: ' + id);
    for (const action of Object.keys(this.actions)) {
      if (this.actions[action].current)
        this.actions[action].current.onSegmentCreated(id);
    }
  };
  onSegmentUpdated = id => {
    console.info('Segment Updated: ' + id);
    for (const action of Object.keys(this.actions)) {
      if (this.actions[action].current)
        this.actions[action].current.onSegmentUpdated(id);
    }
  };
  onSegmentDeleted = id => {
    console.info('Segment Deleted: ' + id);
    for (const action of Object.keys(this.actions)) {
      if (this.actions[action].current)
        this.actions[action].current.onSegmentDeleted(id);
    }
  };
  onSegmentSelected = id => {
    console.info('Segment Selected: ' + id);
    for (const action of Object.keys(this.actions)) {
      if (this.actions[action].current)
        this.actions[action].current.onSegmentSelected(id);
    }
  };

  onSelectActionTab = name => {
    // Leave Event
    for (const action of Object.keys(this.actions)) {
      if (this.state.action === action) {
        if (this.actions[action].current)
          this.actions[action].current.onLeaveActionTab();
      }
    }

    // Enter Event
    for (const action of Object.keys(this.actions)) {
      if (name === action) {
        if (this.actions[action].current)
          this.actions[action].current.onEnterActionTab();
      }
    }

    this.setState({ action: name });
  };

  onOptionsConfig = () => {
    return this.actions['options'].current &&
      this.actions['options'].current.state
      ? this.actions['options'].current.state.config
      : {};
  };

  updateView = async (response, labels, operation, slice, overlap) => {
    this.segmentationList.current.updateView(
      response,
      labels,
      operation,
      slice,
      overlap
    );
  };

  render() {
    return (
      <div className="monaiLabelPanel">
        <SegmentationList
          ref={this.segmentationList}
          viewConstants={this.viewConstants}
          onSegmentCreated={this.onSegmentCreated}
          onSegmentUpdated={this.onSegmentUpdated}
          onSegmentDeleted={this.onSegmentDeleted}
          onSegmentSelected={this.onSegmentSelected}
        />
        <br style={{ margin: '3px' }} />

        <SettingsTable ref={this.settings} />

        <hr className="seperator" />
        <p className="subtitle">{this.state.info.name}</p>

        <div className="tabs scrollbar" id="style-3">
          <OptionTable
            ref={this.actions['options']}
            tabIndex={1}
            info={this.state.info}
            viewConstants={this.viewConstants}
            client={this.client}
            notification={this.notification}
            updateView={this.updateView}
            onSelectActionTab={this.onSelectActionTab}
          />

          <ActiveLearning
            ref={this.actions['activelearning']}
            tabIndex={2}
            info={this.state.info}
            viewConstants={this.viewConstants}
            client={this.client}
            notification={this.notification}
            updateView={this.updateView}
            onSelectActionTab={this.onSelectActionTab}
            onOptionsConfig={this.onOptionsConfig}
          />

          <AutoSegmentation
            ref={this.actions['segmentation']}
            tabIndex={3}
            info={this.state.info}
            viewConstants={this.viewConstants}
            client={this.client}
            notification={this.notification}
            updateView={this.updateView}
            onSelectActionTab={this.onSelectActionTab}
            onOptionsConfig={this.onOptionsConfig}
          />
          <SmartEdit
            ref={this.actions['smartedit']}
            tabIndex={4}
            info={this.state.info}
            viewConstants={this.viewConstants}
            client={this.client}
            notification={this.notification}
            updateView={this.updateView}
            onSelectActionTab={this.onSelectActionTab}
            onOptionsConfig={this.onOptionsConfig}
          />
        </div>

        <p>&nbsp;</p>
      </div>
    );
  }
}
