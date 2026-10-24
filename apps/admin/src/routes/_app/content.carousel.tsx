import { createFileRoute } from '@tanstack/react-router';
import { CarouselPage } from '~/features/carousel/CarouselPage';

export const Route = createFileRoute('/_app/content/carousel')({
  component: CarouselPage,
});
