<?php

use Fleetbase\Support\Utils;

// Labels per A4 sheet: always 2 columns, 2/4/6/8 rows (default 4 = 8 labels per sheet).
$columns     = 2;
$rowsPerPage = (int) ($rows ?? 4);
$rowsPerPage = in_array($rowsPerPage, [2, 4, 6, 8], true) ? $rowsPerPage : 4;
$perPage     = $columns * $rowsPerPage;

// Printable height is 297mm - 2 x 8mm page margin = 281mm; 272mm leaves room for the cell borders.
$cellHeight = floor(272 / $rowsPerPage);

// Denser layouts shrink the QR code and fonts, and collapse addresses to a single line.
$profiles = [
	2 => ['qr' => 96, 'id' => 16, 'base' => 12, 'small' => 11, 'padV' => 4, 'padH' => 5, 'gap' => 2, 'inline' => []],
	4 => ['qr' => 54, 'id' => 12, 'base' => 9, 'small' => 8, 'padV' => 1.6, 'padH' => 2.1, 'gap' => 0.8, 'inline' => ['pickup', 'entities', 'info']],
	6 => ['qr' => 44, 'id' => 10, 'base' => 8, 'small' => 7, 'padV' => 1.2, 'padH' => 1.6, 'gap' => 0.6, 'inline' => ['pickup', 'dropoff', 'entities', 'info']],
	8 => ['qr' => 34, 'id' => 9, 'base' => 7, 'small' => 6.5, 'padV' => 1, 'padH' => 1.4, 'gap' => 0.4, 'inline' => ['pickup', 'dropoff', 'entities', 'info']],
];
$profile = $profiles[$rowsPerPage];
// Which blocks collapse to a single line in this layout.
$inline = array_fill_keys($profile['inline'], true);

?>
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
		height: <?= $cellHeight ?>mm;
		border: 1px solid #414141;
		padding: 0;
		vertical-align: top;
	}

	.label-inner {
		position: relative;
		height: <?= $cellHeight ?>mm;
		overflow: hidden;
	}

	/* Absolutely positioned so the content never adds to the row height used for pagination. */
	.label-content {
		position: absolute;
		top: <?= $profile['padV'] ?>mm;
		left: <?= $profile['padH'] ?>mm;
		right: <?= $profile['padH'] ?>mm;
		font-size: <?= $profile['base'] ?>px;
		line-height: 1.2;
	}

	.label-header {
		border-bottom: 1px solid #414141;
		padding-bottom: <?= $profile['gap'] ?>mm;
		margin-bottom: <?= $profile['gap'] ?>mm;
	}

	.label-qr {
		width: <?= $profile['qr'] ?>px;
		height: <?= $profile['qr'] ?>px;
	}

	.label-id {
		font-size: <?= $profile['id'] ?>px;
		font-weight: bold;
	}

	.label-tracking {
		font-size: <?= $profile['base'] ?>px;
		color: #333;
	}

	.addr-block {
		margin-top: <?= $profile['gap'] ?>mm;
		font-size: <?= $profile['base'] ?>px;
	}

	.addr-label {
		font-weight: bold;
	}

	.addr-name {
		font-weight: bold;
	}

	.entities {
		margin-top: <?= $profile['gap'] ?>mm;
		font-size: <?= $profile['small'] ?>px;
		color: #333;
	}

	.label-customer {
		font-size: <?= $profile['base'] ?>px;
		font-weight: bold;
		color: #000;
	}

	.label-info {
		margin-top: <?= $profile['gap'] ?>mm;
		font-size: <?= $profile['base'] ?>px;
	}

	.label-info .info-item {
		display: <?= isset($inline['info']) ? 'inline' : 'block' ?>;
	}

	.label-date {
		margin-top: <?= $profile['gap'] ?>mm;
		font-size: <?= $profile['small'] ?>px;
		color: #555;
	}
</style>

<body>
	<?php
	$chunks  = $orders->chunk($perPage);
	$lastChunkIndex = $chunks->count() - 1;
	$customFieldsByOrder = $customFieldsByOrder ?? collect();

	// Pull the "cena-otkupa" (COD) and "broj-primaoca" (recipient phone) custom fields for an order.
	// Values are stored as plain strings and displayed as-is, matching the customer portal.
	$extractCustomFields = function ($order) use ($customFieldsByOrder) {
		$result = ['cod' => null, 'recipient_phone' => null];
		$cfvs   = $customFieldsByOrder->get($order->uuid);
		if (!$cfvs) {
			return $result;
		}
		foreach ($cfvs as $cfv) {
			$name  = data_get($cfv, 'customField.name');
			$value = trim((string) $cfv->value);
			if ($value === '') {
				continue;
			}
			if ($name === 'cena-otkupa') {
				$result['cod'] = $value;
			} elseif ($name === 'broj-primaoca') {
				$result['recipient_phone'] = $value;
			}
		}

		return $result;
	};

	$renderAddress = function ($place, $singleLine = false) {
		if (!$place) {
			return '';
		}
		if ($singleLine) {
			$parts = array_filter([
				$place->name ?? null,
				$place->street1 ?? null,
				$place->street2 ?? null,
				trim(implode(' ', array_filter([$place->postal_code ?? null, $place->city ?? null]))),
				$place->phone_number ?? null,
			]);

			return ' ' . htmlspecialchars(implode(', ', $parts));
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

						$customerName  = data_get($order, 'customer.name');
						$customFields  = $extractCustomFields($order);
						$cod           = $customFields['cod'];
						$recipientPhone = $customFields['recipient_phone'];
						$createdAt     = $order->created_at ? $order->created_at->format('d.m.Y H:i') : null;
						?>
						<td class="label-cell">
							<div class="label-inner"><div class="label-content">
							<table style="width: 100%; border-collapse: collapse;">
								<tr>
									<td style="width: <?= $profile['qr'] + 6 ?>px; vertical-align: top;">
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
											<?php if (!empty($customerName)) { ?>
												<div class="label-customer"><?= htmlspecialchars((string) $customerName) ?></div>
											<?php } ?>
										</div>
									</td>
								</tr>
							</table>

							<?php if ($pickup) { ?>
								<div class="addr-block">
									<span class="addr-label">PICKUP:</span>
									<?= $renderAddress($pickup, isset($inline['pickup'])) ?>
								</div>
							<?php } ?>

							<?php if ($dropoff) { ?>
								<div class="addr-block">
									<span class="addr-label">DROP-OFF:</span>
									<?= $renderAddress($dropoff, isset($inline['dropoff'])) ?>
								</div>
							<?php } ?>

							<?php if (!empty($entities) && count($entities) > 0) {
								$entityLines = [];
								foreach ($entities as $entity) {
									$entityName    = !empty($entity['name']) ? strtoupper($entity['name']) : 'ITEM';
									$internalId    = $entity['internal_id'] ?? '';
									$entityLines[] = $entityName . ($internalId ? ' - ' . $internalId : '');
								}
								?>
								<div class="entities">
									<?php if (isset($inline['entities'])) { ?>
										<?= htmlspecialchars(implode(', ', $entityLines)) ?>
									<?php } else { ?>
										<?php foreach ($entityLines as $entityLine) { ?>
											<div><?= htmlspecialchars($entityLine) ?></div>
										<?php } ?>
									<?php } ?>
								</div>
							<?php } ?>

							<?php if (!empty($cod) || !empty($recipientPhone)) { ?>
								<div class="label-info">
									<?php if (!empty($cod)) { ?>
										<span class="info-item"><strong>Otkup:</strong> <?= htmlspecialchars((string) $cod) ?> RSD</span>
									<?php } ?>
									<?php if (!empty($cod) && !empty($recipientPhone) && isset($inline['info'])) { ?> · <?php } ?>
									<?php if (!empty($recipientPhone)) { ?>
										<span class="info-item"><strong>Primalac:</strong> <?= htmlspecialchars((string) $recipientPhone) ?></span>
									<?php } ?>
								</div>
							<?php } ?>

							<?php if (!empty($createdAt)) { ?>
								<div class="label-date"><?= htmlspecialchars((string) $createdAt) ?></div>
							<?php } ?>
							</div></div>
						</td>
					<?php } ?>
					<?php if (count($row) < $columns) { ?>
						<?php for ($i = count($row); $i < $columns; $i++) { ?>
							<td class="label-cell"><div class="label-inner">&nbsp;</div></td>
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
