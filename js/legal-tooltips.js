(function(){
'use strict';

// NY is now GRAY-ZONE (gold) not restricted (red)
var states=[
{s:'AL',n:'Alabama',st:'legal',d:'No specific crypto restrictions. Standard business regulations apply.'},
{s:'AK',n:'Alaska',st:'legal',d:'No money transmitter laws for crypto. Favorable regulatory environment.'},
{s:'AZ',n:'Arizona',st:'legal',d:'Crypto-friendly legislation. Blockchain technology promoted by state.'},
{s:'AR',n:'Arkansas',st:'legal',d:'Standard regulations. No privacy coin restrictions.'},
{s:'CA',n:'California',st:'legal',d:'DFPI oversees crypto. No privacy coin ban. Active crypto community.'},
{s:'CO',n:'Colorado',st:'legal',d:'Accepts crypto for state payments. Progressive crypto policies.'},
{s:'CT',n:'Connecticut',st:'legal',d:'Money transmitter license required for businesses. Holding legal.'},
{s:'DE',n:'Delaware',st:'legal',d:'Business-friendly state. No specific crypto restrictions.'},
{s:'FL',n:'Florida',st:'legal',d:'Active crypto market. No privacy coin restrictions.'},
{s:'GA',n:'Georgia',st:'legal',d:'Standard money transmitter laws. No crypto-specific bans.'},
{s:'HI',n:'Hawaii',st:'exchange-restricted',d:'Limited exchange access. Digital Currency Innovation Lab program active.'},
{s:'ID',n:'Idaho',st:'legal',d:'No specific restrictions. Low electricity costs favor mining.'},
{s:'IL',n:'Illinois',st:'legal',d:'Digital commerce act. Active blockchain community.'},
{s:'IN',n:'Indiana',st:'legal',d:'Minimal restrictions on crypto. Standard regulations.'},
{s:'IA',n:'Iowa',st:'legal',d:'No specific crypto legislation. Standard rules apply.'},
{s:'KS',n:'Kansas',st:'legal',d:'Standard rules. No privacy coin restrictions.'},
{s:'KY',n:'Kentucky',st:'legal',d:'Standard regulations. Low electricity costs in some areas.'},
{s:'LA',n:'Louisiana',st:'legal',d:'Virtual currency business act. Low electricity costs.'},
{s:'ME',n:'Maine',st:'legal',d:'No specific restrictions on privacy coins.'},
{s:'MD',n:'Maryland',st:'legal',d:'Standard money transmitter laws apply.'},
{s:'MA',n:'Massachusetts',st:'legal',d:'Standard securities regulations. High electricity costs.'},
{s:'MI',n:'Michigan',st:'legal',d:'No specific restrictions on crypto or mining.'},
{s:'MN',n:'Minnesota',st:'legal',d:'Standard regulations. No privacy coin restrictions.'},
{s:'MS',n:'Mississippi',st:'legal',d:'No specific restrictions. Low electricity costs.'},
{s:'MO',n:'Missouri',st:'legal',d:'No specific crypto restrictions.'},
{s:'MT',n:'Montana',st:'legal',d:'Crypto-friendly. Low electricity costs for mining.'},
{s:'NE',n:'Nebraska',st:'legal',d:'Digital asset banking framework. Progressive approach.'},
{s:'NV',n:'Nevada',st:'legal',d:'No income tax. Crypto-friendly legislation.'},
{s:'NH',n:'New Hampshire',st:'legal',d:'No sales tax. Very crypto-friendly policies.'},
{s:'NJ',n:'New Jersey',st:'legal',d:'Standard laws. No privacy coin ban.'},
{s:'NM',n:'New Mexico',st:'legal',d:'No specific restrictions.'},
{s:'NY',n:'New York',st:'gray-zone',d:'BitLicense (23 NYCRR Part 200) creates significant regulatory barriers for businesses offering XMR services in New York. However, individuals may legally hold, mine, and transact with Monero. Most exchanges delist XMR for NY users due to compliance costs, not because individual use is illegal. Mining at home: legal. Holding XMR: legal. Sending XMR: legal. Running a XMR business: requires BitLicense.'},
{s:'NC',n:'North Carolina',st:'legal',d:'Standard laws. No privacy coin restrictions.'},
{s:'ND',n:'North Dakota',st:'legal',d:'Cheapest electricity in US. Ideal for mining.'},
{s:'OH',n:'Ohio',st:'legal',d:'Previously accepted BTC for taxes. No crypto ban.'},
{s:'OK',n:'Oklahoma',st:'legal',d:'No specific restrictions. Low electricity costs.'},
{s:'OR',n:'Oregon',st:'legal',d:'No specific restrictions on crypto.'},
{s:'PA',n:'Pennsylvania',st:'legal',d:'Standard regulations. Active crypto community.'},
{s:'RI',n:'Rhode Island',st:'legal',d:'Standard regulations.'},
{s:'SC',n:'South Carolina',st:'legal',d:'No specific restrictions.'},
{s:'SD',n:'South Dakota',st:'legal',d:'No income tax. Business-friendly.'},
{s:'TN',n:'Tennessee',st:'legal',d:'No income tax. Standard crypto regulations.'},
{s:'TX',n:'Texas',st:'legal',d:'Mining incentives. Very crypto-friendly. Low electricity.'},
{s:'UT',n:'Utah',st:'legal',d:'Blockchain promotion act. Crypto-friendly.'},
{s:'VT',n:'Vermont',st:'legal',d:'Blockchain-friendly legislation.'},
{s:'VA',n:'Virginia',st:'legal',d:'Standard regulations. No privacy coin ban.'},
{s:'WA',n:'Washington',st:'legal',d:'Money transmitter license required for businesses. Low electricity.'},
{s:'WV',n:'West Virginia',st:'legal',d:'No specific restrictions.'},
{s:'WI',n:'Wisconsin',st:'legal',d:'Standard regulations.'},
{s:'WY',n:'Wyoming',st:'legal',d:'Most crypto-friendly state. DAO LLC law. Digital asset framework.'}
];

var countries=[
{s:'UK',n:'United Kingdom',st:'legal',d:'FCA oversees. No privacy coin ban. Standard CGT applies.'},
{s:'DE',n:'Germany',st:'legal',d:'BaFin regulated. Tax-free after 1yr holding period.'},
{s:'IE',n:'Ireland',st:'legal',d:'Revenue Commissioners treat as property. No specific ban.'},
{s:'FR',n:'France',st:'gray-zone',d:'AMF oversight. Privacy coins under scrutiny with EU AMLR.'},
{s:'JP',n:'Japan',st:'exchange-restricted',d:'XMR delisted from all exchanges. Holding and mining legal.'},
{s:'KR',n:'South Korea',st:'exchange-restricted',d:'Privacy coins banned from exchanges since 2021. Holding legal.'},
{s:'AU',n:'Australia',st:'legal',d:'AUSTRAC regulated. Standard CGT. No privacy coin ban.'},
{s:'CA',n:'Canada',st:'legal',d:'CRA treats as commodity. No privacy coin restrictions.'},
{s:'CH',n:'Switzerland',st:'legal',d:'FINMA oversight. Crypto Valley. Very crypto-friendly.'},
{s:'SG',n:'Singapore',st:'legal',d:'MAS regulated. Progressive crypto framework.'},
{s:'NL',n:'Netherlands',st:'legal',d:'DNB registered. EU regulations apply.'},
{s:'BR',n:'Brazil',st:'legal',d:'Active community. Growing crypto adoption.'},
{s:'IN',n:'India',st:'gray-zone',d:'30% tax on crypto gains. Hostile regulatory environment.'},
{s:'RU',n:'Russia',st:'gray-zone',d:'Mining legalized. Trading restricted. Complex regulatory picture.'},
{s:'AE',n:'UAE',st:'legal',d:'VARA in Dubai. Generally crypto-friendly. Some privacy token restrictions.'},
{s:'TH',n:'Thailand',st:'legal',d:'SEC regulated. Standard crypto framework.'},
{s:'PH',n:'Philippines',st:'legal',d:'BSP registered exchanges. Growing adoption.'},
{s:'MX',n:'Mexico',st:'legal',d:'FinTech law covers crypto. Growing market.'},
{s:'NG',n:'Nigeria',st:'gray-zone',d:'Growing P2P market despite central bank restrictions.'},
{s:'ZA',n:'South Africa',st:'legal',d:'FSCA declaration as financial product. Regulated.'},
{s:'AR',n:'Argentina',st:'legal',d:'High adoption due to inflation. Crypto widely used.'},
{s:'CO',n:'Colombia',st:'legal',d:'Growing adoption. No specific crypto ban.'},
{s:'TR',n:'Turkey',st:'exchange-restricted',d:'Crypto payments banned. Exchange trading possible with restrictions.'},
{s:'PL',n:'Poland',st:'legal',d:'EU MiCA regulations apply. No additional restrictions.'},
{s:'CN',n:'China',st:'restricted',d:'All crypto mining and trading banned since 2021.'},
{s:'DZ',n:'Algeria',st:'restricted',d:'All cryptocurrency activities banned since 2018.'},
{s:'BD',n:'Bangladesh',st:'restricted',d:'All crypto banned. Strict enforcement.'},
{s:'EG',n:'Egypt',st:'restricted',d:'Banking restrictions on crypto. Effectively banned.'},
{s:'MA',n:'Morocco',st:'restricted',d:'Crypto banned since 2017. Under review.'},
{s:'NP',n:'Nepal',st:'restricted',d:'NRB banned all crypto. Strict enforcement.'}
];

function positionTooltip(cell){
    var tip=cell.querySelector('.tooltip');
    if(!tip) return;
    tip.style.left='50%';tip.style.right='auto';tip.style.transform='translateX(-50%)';
    requestAnimationFrame(function(){
        var r=tip.getBoundingClientRect();
        var vw=window.innerWidth;
        var pad=8;
        if(r.right>vw-pad){
            var overflow=r.right-(vw-pad);
            tip.style.left='calc(50% - '+overflow+'px)';
        } else if(r.left<pad){
            var under=pad-r.left;
            tip.style.left='calc(50% + '+under+'px)';
        }
    });
}

function init(){
    var all=states.concat(countries);
    document.getElementById('sum-legal').textContent=all.filter(function(x){return x.st==='legal'}).length;
    document.getElementById('sum-exch').textContent=all.filter(function(x){return x.st==='exchange-restricted'}).length;
    document.getElementById('sum-gray').textContent=all.filter(function(x){return x.st==='gray-zone'}).length;
    document.getElementById('sum-rest').textContent=all.filter(function(x){return x.st==='restricted'}).length;

    // Render state grid with hover tooltips
    var sg=document.getElementById('sgrid');
    sg.innerHTML=states.map(function(s){
        var statusLabel=s.st.replace('exchange-','exc-').replace('-zone','');
        var statusColor=s.st==='legal'?'var(--grn)':s.st==='gray-zone'?'var(--gold)':s.st==='restricted'?'var(--red)':'var(--blue)';
        return '<div class="st '+s.st+'" onclick="window.open(\'https://www.google.com/search?q=monero+legal+status+'+encodeURIComponent(s.n)+'\',\'_blank\')">'
            +'<div class="tooltip"><div class="tooltip-name">'+s.n+'</div><div class="tooltip-status" style="color:'+statusColor+'">'+s.st.replace('-',' ').toUpperCase()+'</div><div class="tooltip-detail">'+s.d+'</div></div>'
            +'<div class="st-ab">'+s.s+'</div><div class="st-lb">'+statusLabel+'</div></div>';
    }).join('');

    // Flip tooltip horizontally when it would overflow the viewport (fluid grid)
    document.querySelectorAll('#sgrid .st').forEach(function(cell){
        cell.addEventListener('mouseenter',function(){positionTooltip(cell)});
    });

    // Render country grid
    var cg=document.getElementById('cgrid');
    cg.innerHTML=countries.map(function(c){
        return '<div class="cc" onclick="window.open(\'https://www.google.com/search?q=monero+legal+status+'+encodeURIComponent(c.n)+'\',\'_blank\')">'
            +'<div class="cc-top"><div><div class="cc-name">'+c.n+'</div><div class="cc-code">'+c.s+'</div></div><div class="cc-badge '+c.st+'">'+c.st.replace('-',' ')+'</div></div>'
            +'<div class="cc-detail">'+c.d+'</div></div>';
    }).join('');

    // Mobile: tap to show tooltip (toggle)
    if('ontouchstart' in window){
        document.querySelectorAll('.st').forEach(function(el){
            el.addEventListener('touchstart',function(e){
                var wasActive=el.querySelector('.tooltip').style.display==='block';
                document.querySelectorAll('.tooltip').forEach(function(t){t.style.display='none'});
                if(!wasActive){el.querySelector('.tooltip').style.display='block';e.preventDefault()}
            });
        });
        document.addEventListener('touchstart',function(e){
            if(!e.target.closest('.st')){document.querySelectorAll('.tooltip').forEach(function(t){t.style.display='none'})}
        });
    }
}

if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
} else {
    init();
}
})();
