<?php

use Fleetbase\Support\Utils; ?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">

<head>
	<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
	<title>Order Labels</title>
</head>

<style>
	@page {
		margin: 8mm;
	}

	body {
		font-family: DejaVu Sans, sans-serif;
		margin: 0;
		padding: 0;
	}

	table.sheet {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}

	table.sheet td.label-cell {
		width: 50%;
		height: 65mm;
		border: 1px solid #414141;
		padding: 6px 8px;
		vertical-align: top;
		box-sizing: border-box;
		overflow: hidden;
	}

	.label-header {
		border-bottom: 1px solid #414141;
		padding-bottom: 4px;
		margin-bottom: 4px;
	}

	.label-qr {
		width: 60px;
		height: 60px;
		object-fit: contain;
	}

	.label-id {
		font-size: 13px;
		font-weight: bold;
	}

	.label-tracking {
		font-size: 10px;
		color: #333;
	}

	.addr-block {
		margin-top: 4px;
		font-size: 10px;
		line-height: 1.25;
	}

	.addr-label {
		font-weight: bold;
		font-size: 10px;
	}

	.addr-name {
		font-weight: 600;
	}

	.entities {
		margin-top: 4px;
		font-size: 9px;
		color: #333;
	}
</style>

<body>
	<?php
	$perPage = 8;   // 2 columns x 4 rows per A4 sheet
	$columns = 2;
	$chunks  = $orders->chunk($perPage);
	$lastChunkIndex = $chunks->count() - 1;

	$renderAddress = function ($place) {
		if (!$place) {
			return '';
		}
		$html = '<div class="addr-name">' . htmlspecialchars((string) $place->name) . '</div>';
		if (!empty($place->street1)) {
			$html .= '<div>' . htmlspecialchars((string) $place->street1) . '</div>';
		}
		if (!empty($place->street2)) {
			$html .= '<div>' . htmlspecialchars((string) $place->street2) . '</div>';
		}
		$cityLine = array_filter([
			$place->postal_code ?? null,
			$place->city ?? null,
			$place->province ?? null,
		]);
		if (!empty($cityLine)) {
			$html .= '<div>' . htmlspecialchars(implode(', ', $cityLine)) . '</div>';
		}
		if (!empty($place->phone_number)) {
			$html .= '<div>' . htmlspecialchars((string) $place->phone_number) . '</div>';
		}

		return $html;
	};
	?>

	<?php foreach ($chunks as $chunkIndex => $chunk) { ?>
		<table class="sheet">
			<?php
			$rows = $chunk->values()->chunk($columns);
			?>
			<?php foreach ($rows as $row) { ?>
				<tr>
					<?php foreach ($row as $order) { ?>
						<?php
						$trackingNumber = $order->trackingNumber;
						$qrCode         = $trackingNumber ? $trackingNumber->qr_code : null;
						$order->load('payload.pickup', 'payload.dropoff', 'payload.entities');
						$pickup   = $order->payload ? $order->payload->pickup : null;
						$dropoff  = $order->payload ? $order->payload->dropoff : null;
						$entities = $order->payload ? ($order->payload['entities'] ?? []) : [];
						?>
						<td class="label-cell">
							<table style="width: 100%; border-collapse: collapse;">
								<tr>
									<td style="width: 66px; vertical-align: top;">
										<?php if ($qrCode) { ?>
											<img class="label-qr" src="data:image/png;base64,<?= $qrCode ?>" />
										<?php } ?>
									</td>
									<td style="vertical-align: top;">
										<div class="label-header">
											<div class="label-id"><?= htmlspecialchars((string) $order->public_id) ?></div>
											<?php if (Utils::notEmpty($trackingNumber)) { ?>
												<div class="label-tracking"><?= htmlspecialchars((string) $trackingNumber->tracking_number) ?></div>
											<?php } ?>
										</div>
									</td>
								</tr>
							</table>

							<?php if ($pickup) { ?>
								<div class="addr-block">
									<span class="addr-label">PICKUP:</span>
									<?= $renderAddress($pickup) ?>
								</div>
							<?php } ?>

							<?php if ($dropoff) { ?>
								<div class="addr-block">
									<span class="addr-label">DROP-OFF:</span>
									<?= $renderAddress($dropoff) ?>
								</div>
							<?php } ?>

							<?php if (!empty($entities) && count($entities) > 0) { ?>
								<div class="entities">
									<?php foreach ($entities as $entity) {
										$entityName = !empty($entity['name']) ? strtoupper($entity['name']) : 'ITEM';
										$internalId = $entity['internal_id'] ?? '';
										?>
										<div><?= htmlspecialchars($entityName . ($internalId ? ' - ' . $internalId : '')) ?></div>
									<?php } ?>
								</div>
							<?php } ?>
						</td>
					<?php } ?>
					<?php if (count($row) < $columns) { ?>
						<?php for ($i = count($row); $i < $columns; $i++) { ?>
							<td class="label-cell">&nbsp;</td>
						<?php } ?>
					<?php } ?>
				</tr>
			<?php } ?>
		</table>
		<?php if ($chunkIndex < $lastChunkIndex) { ?>
			<div style="page-break-after: always;"></div>
		<?php } ?>
	<?php } ?>
</body>

</html>
