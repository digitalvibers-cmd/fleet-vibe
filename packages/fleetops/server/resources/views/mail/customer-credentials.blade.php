<x-mail-layout>
<h2 style="font-size: 18px; font-weight: 600;">
@if($currentHour < 12)
    Good Morning, {{ $customer->name }}!
@elseif($currentHour < 18)
    Good Afternoon, {{ $customer->name }}!
@else
    Good Evening, {{ $customer->name }}!
@endif
</h2>

Your login credentials:
<br />
<br />
Your Email: {{ $customer->user->email }}
<br />
Your Password: {{ $plaintextPassword }}
<br />
<br />
Za pristup klijentskom portalu: <a href="https://flybox.rs">https://flybox.rs</a>

</x-mail-layout>
