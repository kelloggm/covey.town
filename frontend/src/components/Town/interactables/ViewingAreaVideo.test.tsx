import { ChakraProvider } from '@chakra-ui/react';
import { EventNames } from '@socket.io/component-emitter';
import { cleanup, render, RenderResult } from '@testing-library/react';
import { mock, MockProxy } from 'jest-mock-extended';
import React from 'react';
import { act } from 'react-dom/test-utils';
import type { ReactPlayerProps } from 'react-player';
import TownController from '../../../classes/TownController';
import ViewingAreaController, {
  ViewingAreaEvents,
} from '../../../classes/interactable/ViewingAreaController';
import TownControllerContext from '../../../contexts/TownControllerContext';
import { ViewingAreaVideo } from './ViewingAreaVideo';

// Mocking a React class-based component appears to be quite challenging; we define our own mock implementation
// that mimics the subset of behaviour needed for these tests.
jest.mock('react-player', () => {
  const React = require('react');
  const placeholder = 'MOCK_REACT_PLAYER_PLACEHOLER';
  const stateKey = '__mockReactPlayerState__';
  const globalAny = globalThis as Record<string, any>;
  if (!globalAny[stateKey]) {
    globalAny[stateKey] = {
      mockReactPlayerConstructor: jest.fn(),
      componentDidUpdateSpy: jest.fn(),
      seekSpy: jest.fn(),
      latestInstance: undefined,
    };
  }
  const state = globalAny[stateKey];
  class MockReactPlayer extends React.Component {
    constructor(props: ReactPlayerProps) {
      super(props);
      this.currentTime = 0;
      state.mockReactPlayerConstructor(props);
      state.latestInstance = this;
    }

    getCurrentTime() {
      return this.currentTime;
    }

    seekTo(newTime: number, _unit?: 'seconds' | 'fraction') {
      this.currentTime = newTime;
      state.seekSpy(newTime);
    }

    componentDidUpdate() {
      state.componentDidUpdateSpy(this.props);
    }

    render() {
      return React.createElement(React.Fragment, null, placeholder);
    }
  }
  return {
    __esModule: true,
    default: MockReactPlayer,
  };
});

// A sentinel value that we will render in the mock react player component to help find it in the DOM tree
const MOCK_REACT_PLAYER_PLACEHOLDER = 'MOCK_REACT_PLAYER_PLACEHOLER';

type MockReactPlayerInstance = React.Component<ReactPlayerProps> & {
  currentTime: number;
  getCurrentTime(): number;
  seekTo(newTime: number, unit?: 'seconds' | 'fraction'): void;
};

type ReactPlayerMockState = {
  mockReactPlayerConstructor: jest.Mock<void, [ReactPlayerProps]>;
  componentDidUpdateSpy: jest.Mock<void, [ReactPlayerProps]>;
  seekSpy: jest.Mock<void, [number]>;
  latestInstance?: MockReactPlayerInstance;
};

function getMockReactPlayerState(): ReactPlayerMockState {
  const stateKey = '__mockReactPlayerState__';
  const globalAny = globalThis as Record<string, unknown>;
  const state = globalAny[stateKey] as ReactPlayerMockState | undefined;
  if (!state) {
    throw new Error('ReactPlayer mock state not initialized');
  }
  return state;
}

function renderViewingArea(viewingArea: ViewingAreaController, controller: TownController) {
  return (
    <ChakraProvider>
      <TownControllerContext.Provider value={controller}>
        <ViewingAreaVideo controller={viewingArea} />
      </TownControllerContext.Provider>
    </ChakraProvider>
  );
}

describe('[T4] Viewing Area Video', () => {
  let mockReactPlayer: MockReactPlayerInstance;
  let mockState: ReactPlayerMockState;
  let viewingArea: ViewingAreaController;
  type ViewingAreaEventName = keyof ViewingAreaEvents;
  let addListenerSpy: jest.SpyInstance<
    ViewingAreaController,
    [event: ViewingAreaEventName, listener: ViewingAreaEvents[ViewingAreaEventName]]
  >;

  let removeListenerSpy: jest.SpyInstance<
    ViewingAreaController,
    [event: ViewingAreaEventName, listener: ViewingAreaEvents[ViewingAreaEventName]]
  >;

  let townController: MockProxy<TownController>;

  let renderData: RenderResult;
  beforeEach(() => {
    mockState = getMockReactPlayerState();
    mockState.mockReactPlayerConstructor.mockClear();
    mockState.componentDidUpdateSpy.mockClear();
    mockState.seekSpy.mockClear();
    townController = mock<TownController>();
    viewingArea = new ViewingAreaController({
      elapsedTimeSec: 0,
      id: 'test',
      isPlaying: true,
      video: 'test',
      occupants: [],
      type: 'ViewingArea',
    });

    addListenerSpy = jest.spyOn(viewingArea, 'addListener');
    removeListenerSpy = jest.spyOn(viewingArea, 'removeListener');

    renderData = render(renderViewingArea(viewingArea, townController));
    if (!mockState.latestInstance) {
      throw new Error('Mock ReactPlayer was not instantiated');
    }
    mockReactPlayer = mockState.latestInstance;
  });
  /**
   * Retrieve the properties passed to the ReactPlayer the first time it was rendered
   */
  function firstReactPlayerConstructorProps() {
    return mockState.mockReactPlayerConstructor.mock.calls[0][0];
  }
  /**
   * Retrieve the properties passed to the ReactPlayer the last time it was rendered
   */
  function lastReactPlayerPropUpdate() {
    return mockState.componentDidUpdateSpy.mock.calls[mockState.componentDidUpdateSpy.mock.calls.length - 1][0];
  }
  /**
   * Retrieve the playback time that was passed to 'seek' in its most recent call
   */
  function lastSeekCall() {
    return mockState.seekSpy.mock.calls[mockState.seekSpy.mock.calls.length - 1][0];
  }
  /**
   * Retrieve the listener passed to "addListener" for a given eventName
   * @throws Error if the addListener method was not invoked exactly once for the given eventName
   */
  function getSingleListenerAdded<Ev extends EventNames<ViewingAreaEvents>>(
    eventName: Ev,
    spy = addListenerSpy,
  ): ViewingAreaEvents[Ev] {
    const addedListeners = spy.mock.calls.filter(eachCall => eachCall[0] === eventName);
    if (addedListeners.length !== 1) {
      throw new Error(
        `Expected to find exactly one addListener call for ${eventName} but found ${addedListeners.length}`,
      );
    }
    return addedListeners[0][1] as unknown as ViewingAreaEvents[Ev];
  }
  /**
   * Retrieve the listener pased to "removeListener" for a given eventName
   * @throws Error if the removeListener method was not invoked exactly once for the given eventName
   */
  function getSingleListenerRemoved<Ev extends EventNames<ViewingAreaEvents>>(
    eventName: Ev,
  ): ViewingAreaEvents[Ev] {
    const removedListeners = removeListenerSpy.mock.calls.filter(
      eachCall => eachCall[0] === eventName,
    );
    if (removedListeners.length !== 1) {
      throw new Error(
        `Expected to find exactly one removeListeners call for ${eventName} but found ${removedListeners.length}`,
      );
    }
    return removedListeners[0][1] as unknown as ViewingAreaEvents[Ev];
  }
  describe('[T4] ReactPlayer rendering', () => {
    it('Sets the videoURL', () => {
      const props = firstReactPlayerConstructorProps();
      expect(props.url).toEqual(viewingArea.video);
    });
    it('Sets the playing property', () => {
      const props = firstReactPlayerConstructorProps();
      expect(props.playing).toEqual(viewingArea.isPlaying);
    });
  });
  describe('[T4] Bridging events from the ViewingAreaController to the ReactPlayer', () => {
    describe('Registering ViewingAreaController listeners', () => {
      describe('When rendered', () => {
        it('Registers exactly one progressChange listener', () => {
          act(() => {
            viewingArea.emit('playbackChange', false);
          });
          act(() => {
            viewingArea.emit('playbackChange', true);
          });
          act(() => {
            viewingArea.emit('playbackChange', false);
          });
          getSingleListenerAdded('progressChange');
        });
        it('Removes the progressChange listener at unmount', () => {
          act(() => {
            viewingArea.emit('progressChange', 30);
          });
          const listenerAdded = getSingleListenerAdded('progressChange');
          cleanup();
          expect(getSingleListenerRemoved('progressChange')).toBe(listenerAdded);
        });
        it('Registers exactly one playbackChange listener', () => {
          act(() => {
            viewingArea.emit('playbackChange', true);
          });
          act(() => {
            viewingArea.emit('playbackChange', false);
          });
          act(() => {
            viewingArea.emit('playbackChange', true);
          });
          act(() => {
            viewingArea.emit('playbackChange', false);
          });
          getSingleListenerAdded('playbackChange');
        });
        it('Removes the playbackChange listener at unmount', () => {
          act(() => {
            viewingArea.emit('playbackChange', true);
          });
          const listenerAdded = getSingleListenerAdded('playbackChange');
          cleanup();
          expect(getSingleListenerRemoved('playbackChange')).toBe(listenerAdded);
        });
      });
      describe('When re-rendered with a different viewing area controller', () => {
        it('Removes the listeners on the old viewing area controller and adds listeners to the new controller', () => {
          const origPlayback = getSingleListenerAdded('playbackChange');
          const origProgress = getSingleListenerAdded('progressChange');

          const newViewingArea = new ViewingAreaController({
            elapsedTimeSec: 0,
            id: 'test',
            isPlaying: true,
            video: 'test',
            occupants: [],
            type: 'ViewingArea',
          });
          const newAddListenerSpy = jest.spyOn(newViewingArea, 'addListener');
          renderData.rerender(renderViewingArea(newViewingArea, townController));

          expect(getSingleListenerRemoved('playbackChange')).toBe(origPlayback);
          expect(getSingleListenerRemoved('progressChange')).toBe(origProgress);

          getSingleListenerAdded('playbackChange', newAddListenerSpy);
          getSingleListenerAdded('progressChange', newAddListenerSpy);
        });
      });
    });
    it('Pauses the video on playbackChange', async () => {
      expect(viewingArea.isPlaying).toBe(true);
      expect(mockState.componentDidUpdateSpy).not.toBeCalled();
      act(() => {
        viewingArea.emit('playbackChange', false);
      });
      const newProps = lastReactPlayerPropUpdate();
      expect(newProps.playing).toBe(false);
    });
    it('Unpauses the video on playbackChange', () => {
      expect(viewingArea.isPlaying).toBe(true);
      expect(mockState.componentDidUpdateSpy).not.toBeCalled();
      act(() => {
        viewingArea.emit('playbackChange', false);
      });
      let newProps = lastReactPlayerPropUpdate();
      expect(newProps.playing).toBe(false);

      act(() => {
        viewingArea.emit('playbackChange', true);
      });
      newProps = lastReactPlayerPropUpdate();
      expect(newProps.playing).toBe(true);
    });
    it('Seeks the video when the drift is more than ALLOWED_DRIFT', () => {
      mockReactPlayer.currentTime = 10;
      act(() => {
        viewingArea.emit('progressChange', 13.01);
      });
      expect(lastSeekCall()).toEqual(13.01);

      mockReactPlayer.currentTime = 10;
      act(() => {
        viewingArea.emit('progressChange', 6.99);
      });
      expect(lastSeekCall()).toEqual(6.99);
    });
    it('Does not seek the video if the drift is less than ALLOWED_DRIFT', () => {
      mockReactPlayer.currentTime = 10;
      act(() => {
        viewingArea.emit('progressChange', 13);
      });
      expect(mockState.seekSpy).not.toBeCalled();
    });
  });
  describe('[T4] Bridging events from the ReactPlayer to the ViewingAreaController', () => {
    it('Registers listeners for onProgress, onPlay, onPause, and onEnded', () => {
      const props = firstReactPlayerConstructorProps();
      expect(props.onPlay).toBeDefined();
      expect(props.onPause).toBeDefined();
      expect(props.onEnded).toBeDefined();
      expect(props.onProgress).toBeDefined();
    });
    it("updates the viewing area controller's model and emits an update to the town onPlay", () => {
      const { onPlay } = firstReactPlayerConstructorProps();
      expect(viewingArea.isPlaying).toBe(true);
      act(() => {
        viewingArea.isPlaying = false;
      });
      act(() => {
        if (onPlay) {
          onPlay();
        }
      });
      expect(viewingArea.isPlaying).toBe(true);
      expect(townController.emitViewingAreaUpdate).toBeCalledWith(viewingArea);
    });

    it("updates the viewing area controller's model and emits an update to the town onPause", () => {
      const { onPause } = firstReactPlayerConstructorProps();
      expect(viewingArea.isPlaying).toBe(true);
      act(() => {
        if (onPause) onPause();
      });
      expect(viewingArea.isPlaying).toBe(false);
      expect(townController.emitViewingAreaUpdate).toBeCalledWith(viewingArea);
    });
    it("updates the viewing area controller's model and emits an update to the town onEnded", () => {
      const { onEnded } = firstReactPlayerConstructorProps();
      expect(viewingArea.isPlaying).toBe(true);
      act(() => {
        if (onEnded) onEnded();
      });
      expect(viewingArea.isPlaying).toBe(false);
      expect(townController.emitViewingAreaUpdate).toBeCalledWith(viewingArea);
    });
    it("updates the viewing area controller's model and emits an update to the town onProgress", () => {
      const { onProgress } = firstReactPlayerConstructorProps();
      expect(viewingArea.isPlaying).toBe(true);
      const newElapsedTimeSec = 10;
      act(() => {
        if (onProgress)
          onProgress({ loaded: 0, playedSeconds: newElapsedTimeSec, loadedSeconds: 0, played: 0 });
      });
      expect(viewingArea.elapsedTimeSec).toBe(newElapsedTimeSec);
      expect(townController.emitViewingAreaUpdate).toBeCalledWith(viewingArea);
    });
    it('does not emit an update to the town for onPlay, onPause, onEnded or onProgress if the new state matches the existing state of the controller', () => {
      const { onPlay, onProgress, onEnded, onPause } = firstReactPlayerConstructorProps();
      if (!onPlay) {
        fail('Unable to find an onPlay handler');
      }
      if (!onProgress) {
        fail('Unable to find an onProgress handler');
      }
      if (!onEnded) {
        fail('Unable to find an onEnded handler');
      }
      if (!onPause) {
        fail('Unable to find an onPause handler');
      }

      act(() => {
        viewingArea.isPlaying = true;
      });
      onPlay();
      expect(townController.emitViewingAreaUpdate).not.toBeCalled();

      act(() => {
        viewingArea.elapsedTimeSec = 100;
      });
      onProgress({ playedSeconds: 100, loaded: 0, loadedSeconds: 0, played: 0 });
      expect(townController.emitViewingAreaUpdate).not.toBeCalled();

      act(() => {
        viewingArea.isPlaying = false;
      });
      onPause();
      expect(townController.emitViewingAreaUpdate).not.toBeCalled();

      act(() => {
        viewingArea.isPlaying = false;
      });
      onEnded();
      expect(townController.emitViewingAreaUpdate).not.toBeCalled();
    });
  });
});
