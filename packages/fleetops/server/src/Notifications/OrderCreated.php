<?php

namespace Fleetbase\FleetOps\Notifications;

use Fleetbase\FleetOps\Models\Order;
use Fleetbase\Support\PushNotification;
use Illuminate\Broadcasting\Channel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use NotificationChannels\Apn\ApnChannel;
use NotificationChannels\Fcm\FcmChannel;

class OrderCreated extends Notification implements ShouldQueue
{
    use Queueable;

    public $order;
    public static string $name = 'Order Created';
    public static string $description = 'Notify when a new order is created by a customer.';
    public static string $package = 'fleet-ops';
    public string $title;
    public string $message;
    public array $data = [];

    public function __construct(Order $order)
    {
        $this->order   = $order;
        $customerName  = $order->customer_name ?? 'klijenta';
        $this->title   = 'Flybox - Nova dostava je kreirana od klijenta ' . $customerName;
        $this->message = 'Otvori FleetVibe i dodeli vozaca i cenu usluge.';
        $this->data    = ['id' => $this->order->public_id, 'type' => 'order_created'];
    }

    public function via($notifiable)
    {
        return ['broadcast', 'mail', FcmChannel::class, ApnChannel::class];
    }

    public function broadcastOn()
    {
        return [
            new Channel('company.' . session('company', data_get($this->order, 'company.uuid'))),
            new Channel('company.' . data_get($this->order, 'company.public_id')),
            new Channel('api.' . session('api_credential')),
            new Channel('order.' . $this->order->uuid),
            new Channel('order.' . $this->order->public_id),
        ];
    }

    public function toArray()
    {
        return [
            'event' => 'order.created_notification',
            'title' => $this->title,
            'body'  => $this->message,
            'data'  => $this->data,
        ];
    }

    public function toMail($notifiable)
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

    public function toFcm($notifiable)
    {
        return PushNotification::createFcmMessage($this->title, $this->message, $this->data);
    }

    public function toApn($notifiable)
    {
        return PushNotification::createApnMessage($this->title, $this->message, $this->data, 'view_order');
    }
}
