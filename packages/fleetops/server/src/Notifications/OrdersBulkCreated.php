<?php

namespace Fleetbase\FleetOps\Notifications;

use Fleetbase\FleetOps\Models\Order;
use Illuminate\Broadcasting\Channel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OrdersBulkCreated extends Notification implements ShouldQueue
{
    use Queueable;

    public $order;
    public int $count;
    public static string $name = 'Bulk Orders Created';
    public static string $description = 'Notify when multiple orders are created via bulk import.';
    public static string $package = 'fleet-ops';
    public string $title;
    public string $message;
    public array $data = [];

    public function __construct(Order $order, int $count)
    {
        $this->order   = $order;
        $this->count   = $count;
        $customerName  = $order->customer_name ?? 'klijenta';
        $this->title   = "Flybox - Kreirano je {$count} novih dostava od {$customerName}";
        $this->message = "Uvezeno je {$count} novih porudžbina. Otvori FleetVibe i dodeli vozače.";
        $this->data    = ['count' => $count, 'type' => 'orders_bulk_created'];
    }

    public function via($notifiable): array
    {
        return ['broadcast', 'mail'];
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('company.' . session('company', data_get($this->order, 'company.uuid'))),
            new Channel('company.' . data_get($this->order, 'company.public_id')),
            new Channel('api.' . session('api_credential')),
        ];
    }

    public function toArray(): array
    {
        return [
            'event' => 'orders.bulk_created_notification',
            'title' => $this->title,
            'body'  => $this->message,
            'data'  => $this->data,
        ];
    }

    public function toMail($notifiable): MailMessage
    {
        $consoleHost  = rtrim(env('CONSOLE_HOST', 'https://fleetvibe.flyboxdelivery.rs'), '/');
        $dashboardUrl = $consoleHost . '/fleet-ops?layout=kanban';

        return (new MailMessage())
            ->subject($this->title)
            ->greeting('Zdravo!')
            ->line($this->message)
            ->action('Otvori FleetVibe', $dashboardUrl)
            ->salutation('FleetVibe tim');
    }
}
