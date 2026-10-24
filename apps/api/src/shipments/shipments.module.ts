import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { CourierRegistry } from './couriers/courier.registry';
import { ShipmentBookingService } from './shipment-booking.service';
import { ShipmentSyncService } from './shipment-sync.service';
import { CourierWebhookController, ShipmentsAdminController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';

/** Step 5: warehouse shipments, courier booking (Steadfast, Pathao, fake) and status sync. */
@Module({
  imports: [AuthModule, DocumentsModule, InventoryModule, OrdersModule],
  controllers: [ShipmentsAdminController, CourierWebhookController],
  providers: [CourierRegistry, ShipmentsService, ShipmentBookingService, ShipmentSyncService],
  exports: [ShipmentsService, ShipmentSyncService],
})
export class ShipmentsModule {}
