import { createFileRoute } from '@tanstack/react-router';
import { AddShopPage } from '~/features/sr/ShopsPage';

export const Route = createFileRoute('/_app/sr/shops/new')({ component: AddShopPage });
