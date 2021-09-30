import * as React from 'react';
import { AppConsumer } from '../AppContext';
import { Navigation } from '../../components/common';
import { ICategoryTree } from '../../types';
import { ChildProps } from 'react-apollo';

type Props = {
  items: ICategoryTree[];
  parentId?: string;
  goToBlock?: (blockId: string) => void;
  goToFloor?: (floorId: string) => void;
};

function NavigationContainer(props: ChildProps<Props>) {
  const { parentId, goToBlock, goToFloor } = props;

  const changeRoute = (item: ICategoryTree) => {
    if (item.parentId === parentId) {
      if (!goToBlock) {
        return null;
      }
      return goToBlock(item._id);
    }

    if (item.type === 'category') {
      if (!goToFloor) {
        return null;
      }

      return goToFloor(item._id);
    }
  };
  return <Navigation {...props} changeRoute={changeRoute} />;
}

const WithContext = (props: Props) => {
  return (
    <AppConsumer>
      {({ goToBlock, goToFloor }) => (
        <NavigationContainer
          {...props}
          goToBlock={goToBlock}
          goToFloor={goToFloor}
        />
      )}
    </AppConsumer>
  );
};

export default WithContext;