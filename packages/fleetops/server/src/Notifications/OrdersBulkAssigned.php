<?php

namespace Fleetbase\FleetOps\Notifications;

use Fleetbase\FleetOps\Models\Driver;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OrdersBulkAssigned extends Notification implements ShouldQueue
{
    use Queueable;

    public int $count;
    public static string $name = 'Bulk Orders Assigned';
    public static string $description = 'Notify a driver when multiple orders are assigned to them at once.';
    public static string $package = 'fleet-ops';
    public string $title;
    public string $message;

    public function __construct(int $count)
    {
        $this->count   = $count;
        $this->title   = "Flybox - Imate {$count} novih ruta!";
        $this->message = "Dodeljeno vam je {$count} novih porudžbina. Otvorite Navigator za detalje.";
    }

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject($this->title)
            ->greeting('Zdravo!')
            ->line($this->message)
            ->line('**Otvorite aplikaciju Navigator**')
            ->salutation('FlyBox tim');
    }

    public function toArray(): array
    {
        return [
            'event'   => 'orders.bulk_assigned_notification',
            'title'   => $this->title,
            'body'    => $this->message,
            'data'    => ['count' => $this->count, 'type' => 'orders_bulk_assigned'],
        ];
    }
}
