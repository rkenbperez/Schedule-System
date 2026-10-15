// pages/teacher/CreateSchedulePage.tsx
export default function CreateSchedulePage() {
  return (
    <section className='w-full'>
      <h1 className='mb-1 text-lg font-medium text-text-primary'>
        Select a schedule
      </h1>
      <p className='mb-6 text-[13px] text-text-secondary'>
        Only slots with no teacher, section, or room conflict are shown as
        available.
      </p>

      <div className='overflow-hidden rounded-card border border-border bg-surface'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-border text-left text-text-secondary'>
              <th className='px-4 py-2.5 font-normal'>Day</th>
              <th className='px-4 py-2.5 font-normal'>Time</th>
              <th className='px-4 py-2.5 font-normal'></th>
            </tr>
          </thead>
          <tbody>
            <tr className='border-b border-border'>
              <td className='px-4 py-3 text-text-primary'>Monday</td>
              <td className='px-4 py-3 text-text-secondary'>7:00 - 10:00 AM</td>
              <td className='px-4 py-3 text-right'>
                <span className='text-[13px] text-text-secondary'>
                  Conflict
                </span>
              </td>
            </tr>
            <tr className='border-b border-border'>
              <td className='px-4 py-3 text-text-primary'>Monday</td>
              <td className='px-4 py-3 text-text-secondary'>1:00 - 3:00 PM</td>
              <td className='px-4 py-3 text-right'>
                <button className='inline-flex items-center gap-1.5 rounded-md bg-apple-green-50 px-3 py-1.5 text-[13px] font-medium text-apple-green-700 transition hover:bg-apple-green-100'>
                  Select
                </button>
              </td>
            </tr>
            <tr className='border-b border-border'>
              <td className='px-4 py-3 text-text-primary'>Tuesday</td>
              <td className='px-4 py-3 text-text-secondary'>
                10:00 AM - 1:00 PM
              </td>
              <td className='px-4 py-3 text-right'>
                <button className='inline-flex items-center gap-1.5 rounded-md bg-apple-green-50 px-3 py-1.5 text-[13px] font-medium text-apple-green-700 transition hover:bg-apple-green-100'>
                  Select
                </button>
              </td>
            </tr>
            <tr className='border-b border-border'>
              <td className='px-4 py-3 text-text-primary'>Wednesday</td>
              <td className='px-4 py-3 text-text-secondary'>3:00 - 6:00 PM</td>
              <td className='px-4 py-3 text-right'>
                <span className='text-[13px] text-text-secondary'>
                  Conflict
                </span>
              </td>
            </tr>
            <tr className='border-b border-border'>
              <td className='px-4 py-3 text-text-primary'>Thursday</td>
              <td className='px-4 py-3 text-text-secondary'>1:00 - 3:00 PM</td>
              <td className='px-4 py-3 text-right'>
                <button className='inline-flex items-center gap-1.5 rounded-md bg-apple-green-50 px-3 py-1.5 text-[13px] font-medium text-apple-green-700 transition hover:bg-apple-green-100'>
                  Select
                </button>
              </td>
            </tr>
            <tr>
              <td className='px-4 py-3 text-text-primary'>Friday</td>
              <td className='px-4 py-3 text-text-secondary'>7:00 - 10:00 AM</td>
              <td className='px-4 py-3 text-right'>
                <button className='inline-flex items-center gap-1.5 rounded-md bg-apple-green-50 px-3 py-1.5 text-[13px] font-medium text-apple-green-700 transition hover:bg-apple-green-100'>
                  Select
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
