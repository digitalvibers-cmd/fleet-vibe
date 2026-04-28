<?php

namespace Fleetbase\FleetOps\Notifications;

use Fleetbase\FleetOps\Http\Resources\v1\Order as OrderResource;
use Fleetbase\FleetOps\Models\Order;
use Fleetbase\Support\PushNotification;
use Illuminate\Broadcasting\Channel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use NotificationChannels\Apn\ApnChannel;
use NotificationChannels\Fcm\FcmChannel;

class OrderAssigned extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * The order instance this notification is for.
     *
     * @var Order
     */
    public $order;

    /**
     * Notification name.
     */
    public static string $name = 'Order Assigned';

    /**
     * Notification description.
     */
    public static string $description = 'Notify when an order has been assigned to a driver.';

    /**
     * Notification package.
     */
    public static string $package = 'fleet-ops';

    /**
     * The title of the notification.
     */
    public string $title;

    /**
     * The message body of the notification.
     */
    public string $message;

    /**
     * Additional data to be sent with the notification.
     */
    public array $data = [];

    /**
     * Whether to include the mail channel. Set to false for bulk assignments
     * where a single summary email is sent separately.
     */
    private bool $mailEnabled;

    /**
     * Create a new notification instance.
     *
     * @return void
     */
    public function __construct(Order $order, bool $mailEnabled = true)
    {
        $this->order       = $order;
        $this->mailEnabled = $mailEnabled;
        $this->title       = 'Flybox - Imate novu rutu!';
        $this->message     = $this->order->isScheduled ? 'Imate novu rutu zakazanu za ' . $this->order->scheduled_at : 'Dodeljena vam je nova ruta. Otvorite Navigator za detalje.';
        $this->data        = ['id' => $this->order->public_id, 'type' => 'order_assigned'];
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array
     */
    public function via($notifiable): array
    {
        $channels = ['broadcast', FcmChannel::class, ApnChannel::class];
        if ($this->mailEnabled) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return Channel|array
     */
    public function broadcastOn()
    {
        return [
            new Channel('company.' . session('company', data_get($this->order, 'company.uuid'))),
            new Channel('company.' . data_get($this->order, 'company.public_id')),
            new Channel('api.' . session('api_credential')),
            new Channel('order.' . $this->order->uuid),
            new Channel('order.' . $this->order->public_id),
            new Channel('driver.' . data_get($this->order, 'driverAssigned.uuid')),
            new Channel('driver.' . data_get($this->order, 'driverAssigned.public_id')),
        ];
    }

    /**
     * Get notification as array.
     *
     * @return void
     */
    public function toArray()
    {
        $order = new OrderResource($this->order);

        return [
            'event' => 'order.assigned_notification',
            'title' => $this->title,
            'body'  => $this->message,
            'data'  => $this->data,
        ];
    }

    /**
     * Get the mail representation of the notification.
     *
     * @return MailMessage
     */
    public function toMail($notifiable)
    {
        $message = (new MailMessage())
            ->subject($this->title)
            ->greeting('Zdravo!')
            ->line($this->message);

        if ($this->order->isScheduled) {
            $message->line('Polazak je zakazan za ' . $this->order->scheduled_at);
        }

        $message->line('**Otvori aplikaciju Navigator**');
        $message->salutation('FleetVibe tim');

        return $message;
    }

    /**
     * Get the firebase cloud message representation of the notification.
     *
     * @return array
     */
    public function toFcm($notifiable)
    {
        return PushNotification::createFcmMessage($this->title, $this->message, $this->data);
    }

    /**
     * Get the apns message representation of the notification.
     *
     * @return array
     */
    public function toApn($notifiable)
    {
        return PushNotification::createApnMessage($this->title, $this->message, $this->data, 'view_order');
    }
}
