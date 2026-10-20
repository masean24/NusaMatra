import { staggerIn, visibleStaggerItems } from './staggerTransition';

function block(id: string, top: number, parent: HTMLElement = document.body): HTMLElement {
  const element = document.createElement('div');
  element.id = id;
  element.setAttribute('data-stagger-item', '');
  element.getBoundingClientRect = () =>
    ({ top, bottom: top + 100, left: 0, right: 300, width: 300, height: 100 }) as DOMRect;
  parent.append(element);
  return element;
}

describe('visibleStaggerItems', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('keeps on-screen blocks in reading order and skips blocks nested in another', () => {
    block('above', -400);
    const title = block('title', 100);
    const card = block('card', 260);
    block('inner', 270, card);
    block('below', window.innerHeight + 50);

    expect(visibleStaggerItems(document.body).map((element) => element.id)).toEqual([title.id, card.id]);
  });

  it('moves the block containing the clicked element to the end', () => {
    block('title', 100);
    const clicked = block('card-1', 260);
    block('card-2', 380);
    const link = document.createElement('a');
    clicked.append(link);

    expect(visibleStaggerItems(document.body, link).map((element) => element.id)).toEqual([
      'title',
      'card-2',
      'card-1',
    ]);
  });
});

describe('staggerIn', () => {
  it('hides every block before its turn so none flashes at full opacity', () => {
    const blocks = [document.createElement('div'), document.createElement('div')];
    const controls = staggerIn(blocks);
    expect(blocks.map((element) => element.style.opacity)).toEqual(['0', '0']);
    controls?.complete();
  });

  it('does nothing for an empty page', () => {
    expect(staggerIn([])).toBeNull();
  });
});
