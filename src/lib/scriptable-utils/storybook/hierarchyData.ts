import {
  chooseColor,
  chooseFont,
  chooseSFSymbol,
  confirm,
  destructiveConfirm,
  form,
  listChooseWithCustom,
  OK,
  pickDate,
  pickDateAndTime,
  pickRelativeDate,
  quickOptions,
  textArea,
  textInput,
} from '../input'
import { notifyNow } from '../notifications'
import {
  Button,
  Container,
  DetailCard,
  Div,
  H1,
  H2,
  NonCascadingDiv,
  P,
  ProgressBar,
  Table,
  ThreeCol,
  Toast,
} from '../UITable'
import { PreviewHierarchy } from './types'
import { popup, singleFieldForm } from './utils'

const WithMargin = (el: Container, marginBottom: number, marginTop?: number) =>
  NonCascadingDiv([el], { marginTop, marginBottom })

const hierarchyData: PreviewHierarchy = {
  input: {
    description: 'Elements used for user input',
    children: {
      chooseColor: { showPreview: chooseColor },

      chooseFont: { showPreview: chooseFont },

      chooseSFSymbol: { showPreview: chooseSFSymbol },

      confirm: {
        description: 'Dialog to prompt user to confirm an action',
        showPreview: () =>
          confirm('Confirm this action?', {
            message: 'An optional message to accompany the title',
          }),
      },

      destructiveConfirm: {
        description: 'Similar to confirm, but with a red confirmation button',
        showPreview: () =>
          destructiveConfirm('Delete this widget?', {
            message: 'Optional message goes here',
          }),
      },

      OK: {
        description: 'Simple dialog to acknowledge a message',
        showPreview: () => OK('Uh-oh!', { message: 'Something went wrong. Try again later.' }),
      },

      'Date input': {
        description: 'Prompt for dates',
        children: {
          pickDate: {
            description: 'Simple date picker using system UI',
            showPreview: pickDate,
          },

          pickDateAndTime: {
            description: 'Simple date picker using system UI',
            showPreview: pickDateAndTime,
          },

          pickRelativeDate: {
            description: 'Custom UI to select dates relative to today',
            showPreview: () =>
              pickRelativeDate({
                allowTimeSelection: true,
                message: 'Which date works for you?',
              }),
          },
        },
      },

      'Form input': {
        children: {
          form: {
            description: 'A self-contained form component with validation',
            showPreview: () =>
              form<{ title: string; value: number; date: Date; color: Color }>({
                title: 'Sample form',
                subtitle: 'Form can not be submitted until validation is satisfied',
                isFormValid: ({ title, value }) => Boolean(title && value),
                fields: {
                  title: {
                    type: 'textInput',
                    label: 'Title',
                    isRequired: true,
                  },
                  value: {
                    type: 'numberValue',
                    label: 'Numerical value',
                    isRequired: true,
                  },
                  date: {
                    type: 'YYYMMDDDatePicker',
                    label: 'Date in YYYY-MM-DD format',
                  },
                  color: { type: 'color', label: 'Favorite color' },
                },
              })(),
          },

          Checkbox: {
            showPreview: () => singleFieldForm({ label: 'Selected?', type: 'checkbox' }),
          },

          ChooseColor: {
            showPreview: () => singleFieldForm({ label: 'Color', type: 'color' }),
          },

          ChooseIcon: {
            showPreview: () => singleFieldForm({ label: 'Icon', type: 'chooseIcon' }),
          },

          Cycle: {
            description: 'Cycle between options',
            showPreview: () =>
              form<{ val: 'A' | 'B' | 'C' }>({
                title: 'My form',
                fields: {
                  val: {
                    type: 'cycle',
                    label: 'Value',
                    options: ['A', 'B', 'C'],
                  },
                },
              })({ val: 'A' }),
          },

          DateAndTimePicker: {
            showPreview: () => singleFieldForm({ label: 'Duedate', type: 'dateAndTimePicker' }),
          },

          Dropdown: {
            showPreview: () =>
              form<{ val: 'A' | 'B' | 'C' }>({
                title: 'My form',
                fields: {
                  val: {
                    type: 'dropdown',
                    label: 'Value',
                    options: ['A', 'B', 'C'],
                    allowCustom: true,
                  },
                },
              })(),
          },

          Number: {
            showPreview: () => singleFieldForm({ label: 'Number', type: 'numberValue' }),
          },

          Radio: {
            showPreview: () =>
              form<{ val: 'A' | 'B' | 'C' }>({
                title: 'My form',
                fields: {
                  val: {
                    type: 'radio',
                    label: 'Value',
                    options: ['A', 'B', 'C'],
                  },
                },
              })(),
          },

          SelectMulti: {
            showPreview: () =>
              form<{ val: string[] }>({
                title: 'My form',
                fields: {
                  val: {
                    type: 'selectMulti',
                    label: 'Value',
                    options: ['A', 'B', 'C'],
                  },
                },
              })({ val: [] }),
          },

          TextArea: {
            showPreview: () => singleFieldForm({ label: 'TextArea', type: 'textarea' }),
          },

          TextInput: {
            showPreview: () => singleFieldForm({ label: 'TextInput', type: 'textInput' }),
          },

          YYYYMMDDDatePicker: {
            showPreview: () => singleFieldForm({ label: 'Date', type: 'YYYMMDDDatePicker' }),
          },
        },
      },

      listChoose: {
        description: 'Select from a list of options',
        showPreview: () =>
          listChooseWithCustom(['First option', 'Second option', 'Third option'], {
            fallbackIcon: 'task_incomplete',
            onOptionSelect: (opt) => notifyNow(`Selected: ${opt}`),
          }),
      },

      quickOptions: {
        description: 'Like listChoose, but using the iOS interface',
        showPreview: () =>
          quickOptions(['First option', 'Second option', 'Third option'], {
            message: 'Put your own message here',
            title: 'You must choose!',
            onOptionSelect: (opt) => notifyNow(`Selected: ${opt}`),
          }),
      },

      textArea: {
        description: 'Fullscreen text input box',
        showPreview: (() => {
          let initValue = ''
          return () =>
            textArea({
              includeClearButton: true,
              initValue,
              onSubmit: (newVal) => (initValue = newVal),
              title: 'textArea',
              message: 'A fullscreen text input option',
              placeholder: 'Buttons on the right allow you to reset or clear the text',
            })
        })(),
      },

      textInput: {
        description: 'Regular text input',
        showPreview: (() => {
          let initValue: string | null = ''
          return () =>
            textInput('textInput', {
              initValue: initValue ?? undefined,
              onSubmit: (newVal) => (initValue = newVal),
              message: 'Text input for shorter entries',
              placeholder: 'Feed me text, nom',
            })
        })(),
      },
    },
  },

  //

  UITable: {
    description: 'Elements used in UI tables',
    children: {
      Button: {
        description: 'Call to action button',
        showPreview: () =>
          popup(
            Div([
              WithMargin(
                Button({
                  text: 'Primary button',
                  icon: 'checkmark',
                  flavor: 'primary',
                  marginTop: 10,
                }),
                10,
                10,
              ),
              WithMargin(
                Button({
                  text: 'Large primary button',
                  icon: 'checkmark',
                  flavor: 'primary',
                  marginTop: 10,
                  isLarge: true,
                }),
                10,
              ),
              WithMargin(Button({ text: 'Default button', icon: 'checkmark' }), 10),
              WithMargin(
                Button({
                  text: 'Danger button',
                  icon: 'checkmark',
                  flavor: 'danger',
                }),
                10,
              ),
              WithMargin(
                Button({
                  text: 'Warning button',
                  icon: 'checkmark',
                  flavor: 'warning',
                }),
                10,
              ),
              WithMargin(
                Button({
                  text: 'Happy button',
                  icon: 'checkmark',
                  flavor: 'happy',
                }),
                10,
              ),
            ]),
          ),
      },

      DetailCard: {
        description: 'A card that can be used to show details of some item',
        showPreview: () =>
          popup(
            Div([
              DetailCard({
                title: 'Card 1',
                titleIcon: 'go_forward',
                containerStyle: { borderTop: 1, borderBottom: 1 },
                details: [
                  { text: 'A fact', icon: 'person' },
                  { text: 'Another fact', icon: 'tag' },
                ],
              }),
              DetailCard({
                title: 'Card 2',
                titleIcon: 'go_forward',
                containerStyle: { borderTop: 1, borderBottom: 1 },
                details: [
                  { text: 'A fact', icon: 'person' },
                  { text: 'Another fact', icon: 'tag' },
                ],
              }),
            ]),
          ),
      },

      H1: {
        showPreview: () =>
          popup([
            H1('The table title'),
            H1('With customization', {
              icon: 'edit',
              subtitle: 'A subtitle here, with custom color',
              subtitleColor: Color.blue(),
            }),
          ]),
      },

      H2: {
        showPreview: () =>
          popup([H2('A slightly smaller header'), H2('An H2 with an optional icon', { icon: 'expand' })]),
      },

      P: {
        description: 'Paragraph text',
        showPreview: () =>
          popup(
            Div(
              [P("Hello there, here is my paragraph text. I've increased the height so that you can see more text.")],
              { height: 100 },
            ),
          ),
      },

      ProgressBar: {
        description: 'Visualize the progress of some process',
        showPreview: () =>
          popup([
            H1('Progress bar', {
              subtitle: 'Progress bar showing 40% completion',
            }),
            ProgressBar(0.4),
          ]),
      },

      ThreeCol: {
        description: 'A row with an icon, main text, and some (optional) metadata',
        showPreview: () =>
          popup(
            ThreeCol({
              icon: 'undo',
              text: 'This is the main text',
              metadata: 4,
            }),
          ),
      },

      Table: {
        description: 'Display table data within a UI table',
        showPreview: () =>
          popup(
            Table({
              columns: {
                'Column A': { isRowValueBold: true },
                'Column B': {},
                'Column C': {},
              },
              rows: [
                {
                  cellValues: {
                    'Column A': 'Alpha',
                    'Column B': 'Bravo',
                    'Column C': 'Charlie',
                  },
                },
                {
                  cellValues: {
                    'Column A': 'Delta',
                    'Column B': 'Echo',
                    'Column C': 'Foxtrot',
                  },
                },
                {
                  cellValues: {
                    'Column A': 'Golf',
                    'Column B': 'Hotel',
                    'Column C': 'India',
                  },
                },
                {
                  cellValues: {
                    'Column A': 'Juliett',
                    'Column B': 'Kilo',
                    'Column C': 'Lima',
                  },
                },
                {
                  cellValues: {
                    'Column A': 'Mike',
                    'Column B': 'November',
                    'Column C': 'Oscar',
                  },
                },
                {
                  cellValues: {
                    'Column A': 'Papa',
                    'Column B': 'Quebec',
                    'Column C': 'Romeo',
                  },
                },
                {
                  cellValues: {
                    'Column A': 'Sierra',
                    'Column B': 'Tango',
                    'Column C': 'Uniform',
                  },
                },
                {
                  cellValues: {
                    'Column A': 'Victor',
                    'Column B': 'Whiskey',
                    'Column C': 'Xray',
                  },
                },
                {
                  cellValues: {
                    'Column A': 'Yankee',
                    'Column B': 'Zulu',
                    'Column C': '',
                  },
                },
              ],
            }),
          ),
      },

      Toast: {
        description: 'An alert banner with various flavors',
        showPreview: () =>
          popup([
            NonCascadingDiv(
              [
                Toast({
                  title: 'Default toast',
                  icon: 'calendar',
                  showCloseIcon: true,
                  metadata: 10,
                  description: 'More information can go here',
                }),
              ],
              { marginTop: 10 },
            ),
            Toast({
              title: 'Primary toast',
              icon: 'calendar',
              showCloseIcon: true,
              metadata: 10,
              flavor: 'primary',
            }),
            Toast({
              title: 'Danger toast',
              icon: 'calendar',
              showCloseIcon: true,
              flavor: 'danger',
            }),
            Toast({
              title: 'Warning toast',
              icon: 'calendar',
              showCloseIcon: true,
              metadata: 10,
              flavor: 'warning',
            }),
            Toast({ title: 'Happy toast', icon: 'calendar', flavor: 'happy' }),
          ]),
      },
    },
  },
}

export default hierarchyData
