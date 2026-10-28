import { fireEvent, render, screen } from '@testing-library/react';
import { setMediaQueryMatches } from '@/test/browserMocks';
import { MapGestureHint } from './MapGestureHint';

describe('MapGestureHint', () => {
  it('tells mouse users what each button and the wheel do', () => {
    render(<MapGestureHint />);
    const list = screen.getByRole('list', { name: 'Cara memakai peta 3D' });
    expect(list).toHaveTextContent('Klik kiri + geser untuk memutar 3D');
    expect(list).toHaveTextContent('Klik kanan + geser untuk menggeser peta');
    expect(list).toHaveTextContent('Scroll untuk memperbesar atau memperkecil');
  });

  it('shows the pinch gesture on a touch screen', () => {
    setMediaQueryMatches('(pointer: coarse)', true);
    render(<MapGestureHint />);
    expect(screen.getByText(/Cubit untuk memperbesar/)).toBeInTheDocument();
  });

  it('leaves on the first touch of the map and does not come back', () => {
    const { unmount } = render(<MapGestureHint />);
    fireEvent.pointerDown(window);
    expect(screen.queryByRole('status')).toBeNull();
    unmount();

    render(<MapGestureHint />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
